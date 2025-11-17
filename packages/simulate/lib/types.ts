import type { Quote, SwapParams } from "@withfabric/smal";
import type { PublicClient, SimulateCallsReturnType } from "viem";

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
