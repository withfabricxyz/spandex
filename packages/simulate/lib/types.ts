import type { Quote, QuoteTxData, SwapParams } from "@withfabric/smal";
import type { Block, PublicClient, SimulateCallsReturnType } from "viem";

/**
 * Error thrown when one or more low level calls revert while simulating a quote.
 *
 * @public
 */
export class SimulationRevertError extends Error {
  /** Per-call metadata returned from `simulateCalls` for each failed call. */
  public readonly failures: {
    call: QuoteTxData;
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
 * Parameters required to simulate a single quote.
 *
 * @public
 */
export type SimulationArgs = {
  /** Public client used to execute `simulateCalls`. */
  client: PublicClient;
  /** Swap parameters shared across quotes, including token, account, and amount details. */
  params: SwapParams;
  /** Quote to simulate, including the encoded transaction data. */
  quote: Quote;
};

/**
 * Result of simulating a quote, including aggregated metadata on success.
 *
 * @public
 */
export type SimulationResult =
  | {
      /** Indicates the simulation completed without errors. */
      success: true;
      /** Final output token amount derived from asset changes. */
      outputAmount: bigint;
      /** Raw `simulateCalls` results for each executed call. */
      callsResults: SimulateCallsReturnType["results"];
      /** Gas used for the swap call. */
      gasUsed?: bigint;
      /** Client-measured duration in milliseconds for the simulated call batch. */
      latency: number;
      /** Block number tied to the simulation response, if the client returned one. */
      blockNumber: bigint | null;
    }
  | {
      /** Indicates the simulation failed and `error` contains the reason. */
      success: false;
      /** Underlying error describing the failure. */
      error: Error;
    };

/**
 * Quote decorated with the corresponding simulation result.
 *
 * @public
 */
export type SimulatedQuote = Quote & {
  /** Result data describing the simulation outcome for the quote. */
  simulation: SimulationResult;
};
