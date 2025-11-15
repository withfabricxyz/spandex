import type { Quote, QuoteTxData, SwapParams } from "@withfabric/smal";
import type { Address, Block, PublicClient, SimulateCallsReturnType } from "viem";
import { encodeFunctionData, erc20Abi, ethAddress, parseEther, zeroAddress } from "viem";
import { simulateCalls } from "viem/actions";
import {
  type SimulatedQuote,
  type SimulationArgs,
  type SimulationResult,
  SimulationRevertError,
} from "./types.js";

/**
 * Simulate a batch of quotes given the shared params/client context.
 *
 * @param args - Shared simulation inputs describing client, params, and quotes to simulate.
 * @param args.params - Swap parameters shared across all quotes.
 * @param args.client - Public client used to perform the simulations.
 * @param args.quotes - Quotes that should be simulated.
 * @returns Quotes decorated with their simulation results.
 */
export async function simulateQuotes(
  args: Omit<SimulationArgs, "quote"> & { quotes: Quote[] },
): Promise<SimulatedQuote[]> {
  const { params, client, quotes } = args;
  return Promise.all(
    quotes.map(async (quote: Quote) => {
      return simulateQuote({
        client,
        params,
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
 * @param args.params - Swap parameters attached to the quote.
 * @param args.quote - Quote instance to simulate.
 * @returns Quote data merged with its simulation result.
 */
export async function simulateQuote(args: SimulationArgs): Promise<SimulatedQuote> {
  return { ...args.quote, simulation: await performSimulation(args) };
}

async function performSimulation({
  client,
  params,
  quote,
}: {
  client: PublicClient;
  params: SwapParams;
  quote: Quote;
}): Promise<SimulationResult> {
  if (!quote.success) {
    return {
      success: false,
      error: new Error("Cannot simulate failed quote"),
    };
  }

  try {
    const isERC20In = params.inputToken !== zeroAddress;
    const isERC20Out = params.outputToken !== zeroAddress;

    // Dynamically build calls array based on whether we need approve / balanceOf (this activates ERC20 handling in assetChanges)
    const calls = [
      isERC20In
        ? {
            to: params.inputToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [quote.txData.to, params.inputAmount],
            }),
          }
        : undefined,
      quote.txData,
      isERC20Out
        ? {
            to: params.outputToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [params.swapperAccount],
            }),
          }
        : undefined,
    ].filter((c): c is QuoteTxData => c !== undefined);

    const time = performance.now();
    const { results, assetChanges, block } = await simulateCalls(client, {
      account: params.swapperAccount,
      calls,
      stateOverrides: [
        {
          address: params.swapperAccount,
          balance: parseEther("10000"), // large amount to cover gas costs + swap value
        },
      ],
      traceAssetChanges: true,
    });
    const latency = performance.now() - time;

    // If any call failed, extract error (TODO: consider treating approval failure differently?)
    validateSimulation(results, calls, block);

    return {
      success: true,
      outputAmount: extractOutputAmount(assetChanges, params.outputToken),
      callsResults: results,
      latency,
      gasUsed: isERC20In ? results[1]?.gasUsed : results[0]?.gasUsed,
      blockNumber: block.number,
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
  calls: QuoteTxData[],
  block: Block,
) {
  const errors = results
    .map((result, i) => {
      if (result.status === "success") return null;
      return {
        call: calls[i] as QuoteTxData,
        result,
        block,
      };
    })
    .filter((e) => e !== null);

  if (errors.length > 0) {
    throw new SimulationRevertError(errors, block);
  }
}
