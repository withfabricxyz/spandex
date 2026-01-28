import type { Address, Block, PublicClient, SimulateCallsReturnType } from "viem";
import { encodeFunctionData, erc20Abi, ethAddress, parseEther, zeroAddress } from "viem";
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
  SwapParams,
  TxData,
} from "./types.js";

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
}: {
  client: PublicClient;
  swap: SwapParams;
  quote: Quote;
}): Promise<SimulationResult> {
  if (!quote.success) {
    return {
      success: false,
      error: new Error("Cannot simulate failed quote"),
    };
  }

  try {
    const isERC20In = swap.inputToken !== zeroAddress;
    const isERC20Out = swap.outputToken !== zeroAddress;

    // Dynamically build calls array based on whether we need approve / balanceOf (this activates ERC20 handling in assetChanges)
    const approvalToken = quote.approval?.token ?? swap.inputToken;
    const approvalSpender = quote.approval?.spender ?? quote.txData.to;
    const calls = [
      isERC20In
        ? {
            to: approvalToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [approvalSpender, quote.inputAmount],
            }),
          }
        : undefined,
      quote.txData,
      isERC20Out
        ? {
            to: swap.outputToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [swap.swapperAccount],
            }),
          }
        : undefined,
    ].filter((c): c is TxData => c !== undefined);

    const time = performance.now();
    const { results, assetChanges, block } = await simulateCalls(client, {
      account: swap.swapperAccount,
      calls,
      stateOverrides: [
        {
          address: swap.swapperAccount,
          balance: parseEther("10000"), // large amount to cover gas costs + swap value
        },
      ],
      traceAssetChanges: true,
    });
    const latency = performance.now() - time;

    // If any call failed, extract error
    validateSimulation(results, calls, block);

    const outputAmount = extractOutputAmount(assetChanges, swap.outputToken);

    // Extra safety: Ensure output amount is positive. Consider simulation failed if not. Could extend to MEV and slippage checks here.
    validateOutputAmount(outputAmount);

    // Extract transfers from relevant call logs
    const swapResult = (
      isERC20In ? results[1] : results[0]
    ) as SimulateCallsReturnType["results"][0];

    return {
      success: true,
      outputAmount: extractOutputAmount(assetChanges, swap.outputToken),
      swapResult,
      latency,
      gasUsed: isERC20In ? results[1]?.gasUsed : results[0]?.gasUsed,
      blockNumber: block.number,
      assetChanges,
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
    };
  }
}

function extractOutputAmount(
  assets: SimulateCallsReturnType["assetChanges"],
  outputToken: Address,
): bigint {
  const comparator = outputToken === zeroAddress ? ethAddress : outputToken.toLowerCase();
  return assets.find((asset) => asset.token.address === comparator)?.value.diff ?? 0n;
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
