import type { Address, Block, PublicClient, SimulateCallsReturnType } from "viem";
import { encodeFunctionData, erc20Abi, parseEther } from "viem";
import { simulateCalls } from "viem/actions";
import type {
  Quote,
  QuotePerformance,
  SimulatedQuote,
  SimulationArgs,
  SimulationResult,
  SimulationSuccess,
  SuccessfulQuote,
  SuccessfulSimulatedQuote,
  TxData,
} from "./types.js";
import { isNativeToken } from "./util/helpers.js";
import { log } from "./util/logger.js";

const multicall3Abi = [
  {
    type: "function",
    name: "getEthBalance",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

/**
 * Error thrown when one or more low level calls revert while simulating a quote.
 *
 * @public
 */
export class SimulationRevertError extends Error {
  /** Per-call metadata returned from `simulateCalls` for each failed call. */
  public readonly failures: {
    call: TxData;
    result: SimulateCallsReturnType["results"][0];
  }[];

  /** Block context used for the simulation run. */
  public readonly block: Block;

  /**
   * @param failures - Per-call metadata returned from `simulateCalls` for each failed call.
   * @param block - The block context used for the simulation run.
   */
  constructor(failures: SimulationRevertError["failures"], block: Block) {
    let message = `\n\nSimulation reverted on the following calls (block=${block.number}):\n`;
    for (const failure of failures) {
      message += `Call to ${failure.call.to} with data: \n`;
      message += `${failure.call.data}\n\n`;

      message += `Revert return data: \n`;
      message += `${failure.result.data}\n`;
      message += failure.result.error ? `Error: ${failure.result.error.message}\n\n` : "\n\n";
    }
    super(message);
    this.failures = failures;
    this.block = block;
  }
}

/**
 * Simulate a batch of quotes given the shared swap/client context.
 *
 * @param args - Shared simulation inputs describing client, swap parameters, and quotes to simulate.
 * @param args.swap - Swap parameters shared across all quotes.
 * @param args.client - Public client used to perform the simulations.
 * @param args.quotes - Quotes that should be simulated.
 * @returns Quotes decorated with their simulation results.
 */
export async function simulateQuotes(
  args: Omit<SimulationArgs, "quote"> & { quotes: Quote[] },
): Promise<SimulatedQuote[]> {
  const { swap, client, quotes } = args;
  return Promise.all(
    quotes.map(async (quote: Quote) => {
      return simulateQuote({
        client,
        swap,
        quote,
      });
    }),
  );
}

/**
 * Simulate a single quote and decorate it with the result.
 *
 * @param args - Parameter bundle including the client, swap params, and quote.
 * @param args.client - Client used to issue the simulation.
 * @param args.swap - Swap parameters attached to the quote.
 * @param args.quote - Quote instance to simulate.
 * @returns Quote data merged with its simulation result.
 */
export async function simulateQuote(args: SimulationArgs): Promise<SimulatedQuote> {
  const simulation = await performSimulation(args);
  if (!simulation.success) {
    return { ...args.quote, simulation };
  }
  return {
    ...args.quote,
    simulation,
    performance: quotePerformance(args.quote as SuccessfulQuote, simulation),
  } as SuccessfulSimulatedQuote;
}

async function performSimulation({
  client,
  swap,
  quote,
}: SimulationArgs): Promise<SimulationResult> {
  if (!quote.success) {
    return {
      success: false,
      error: new Error("Cannot simulate failed quote"),
    };
  }

  try {
    const recipientAccount = swap.recipientAccount ?? swap.swapperAccount;
    const approvalToken = quote.approval?.token ?? swap.inputToken;
    const approvalSpender = quote.approval?.spender ?? quote.txData.to;
    const calls: TxData[] = [];

    // Build calls in a stable order: optional approve, recipient balance before, swap, recipient balance after.
    if (!isNativeToken(swap.inputToken)) {
      calls.push({
        to: approvalToken,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [approvalSpender, quote.inputAmount],
        }),
      });
    }

    // ERC20 or native balance check before and after the swap
    const balanceCall = buildBalanceCall({
      client,
      tokenAddress: swap.outputToken,
      holderAddress: recipientAccount,
    });
    calls.push(balanceCall);
    calls.push(quote.txData);
    calls.push(balanceCall);

    const time = performance.now();
    const { results, block } = await simulateCalls(client, {
      account: swap.swapperAccount,
      calls,
      stateOverrides: [
        {
          address: swap.swapperAccount,
          balance: parseEther("10000"), // large amount to cover gas costs + swap value
        },
      ],
    });
    const latency = performance.now() - time;

    // If any call failed, extract error
    validateSimulation(results, calls, block);

    const [beforeBalanceResult, swapResult, afterBalanceResult] = results.slice(-3);

    // Extract the output amount from the balance deltas and validate it
    const outputAmount = extractOutputAmountFromBalances({
      beforeBalanceResult: beforeBalanceResult as SimulateCallsReturnType["results"][0],
      afterBalanceResult: afterBalanceResult as SimulateCallsReturnType["results"][0],
    });
    validateOutputAmount(outputAmount);

    return {
      success: true,
      outputAmount,
      swapResult: swapResult as SimulateCallsReturnType["results"][0],
      latency,
      gasUsed: swapResult?.gasUsed,
      blockNumber: block.number,
    };
  } catch (error) {
    log("debug", "Quote simulation failed", {
      provider: quote.success ? quote.provider : undefined,
      error,
    });
    return {
      success: false,
      error: error as Error,
    };
  }
}

function buildBalanceCall({
  client,
  tokenAddress,
  holderAddress,
}: {
  client: PublicClient;
  tokenAddress: Address;
  holderAddress: Address;
}): TxData {
  if (!isNativeToken(tokenAddress)) {
    return {
      to: tokenAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [holderAddress],
      }),
    };
  }

  // If we have native, use multicall3 for the balance
  const multicall3Address = client.chain?.contracts?.multicall3?.address;
  if (!multicall3Address) {
    throw new Error(
      `Cannot simulate native output balance delta: multicall3 address is not configured for chain ${client.chain?.id}.`,
    );
  }

  return {
    to: multicall3Address,
    data: encodeFunctionData({
      abi: multicall3Abi,
      functionName: "getEthBalance",
      args: [holderAddress],
    }),
  };
}

function extractOutputAmountFromBalances({
  beforeBalanceResult,
  afterBalanceResult,
}: {
  beforeBalanceResult: SimulateCallsReturnType["results"][0];
  afterBalanceResult: SimulateCallsReturnType["results"][0];
}): bigint {
  const before = parseUint256CallResult(beforeBalanceResult);
  const after = parseUint256CallResult(afterBalanceResult);
  return after - before;
}

function parseUint256CallResult(result: SimulateCallsReturnType["results"][0] | undefined): bigint {
  if (!result) {
    throw new Error("Balance check call result is missing");
  }
  if (result.status !== "success") {
    throw new Error("Balance check call did not succeed");
  }
  if (!result.data || result.data === "0x") {
    throw new Error("Balance check call returned no data");
  }

  try {
    return BigInt(result.data);
  } catch {
    throw new Error(`Unable to decode balance check result: ${result.data}`);
  }
}

function validateSimulation(
  results: SimulateCallsReturnType["results"],
  calls: TxData[],
  block: Block,
) {
  const errors = results
    .map((result, i) => {
      if (result.status === "success") return null;
      return {
        call: calls[i] as TxData,
        result,
        block,
      };
    })
    .filter((e) => e !== null);

  if (errors.length > 0) {
    throw new SimulationRevertError(errors, block);
  }
}

// We consider a zero or negative output amount as a simulation failure (really a setup or contract issue)
// We may also want to consider slippage or MEV checks here.
function validateOutputAmount(amount: bigint) {
  if (amount <= 0n) {
    throw new Error(`Simulated output amount is zero or negative: ${amount.toString()}`);
  }
}

/**
 * Extract common quote metrics from a successful simulated quote.
 * @param quote The successful simulated quote
 * @returns An object containing quote metrics
 */
function quotePerformance(quote: SuccessfulQuote, simulation: SimulationSuccess): QuotePerformance {
  const priceDelta = quoteVersusExecution(quote, simulation);
  return {
    latency: quote.latency,
    gasUsed: simulation.gasUsed ?? 0n,
    outputAmount: simulation.outputAmount,
    priceDelta,
    accuracy: priceDelta !== undefined ? Math.abs(priceDelta) : undefined,
  };
}

function quoteVersusExecution(
  quote: SuccessfulQuote,
  simulation: SimulationSuccess,
): number | undefined {
  const quoted = quote.outputAmount;
  if (quoted === 0n) {
    return undefined;
  }
  const executed = simulation.outputAmount;
  return (Number(executed - quoted) / Number(quoted)) * 10_000;
}
