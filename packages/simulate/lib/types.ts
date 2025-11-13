import type { Quote } from "@withfabric/smal";
import type { SimulateCallsReturnType } from "viem";

export type SimulationResult =
  | {
      success: true;
      outputAmount: bigint;
      callsResults: SimulateCallsReturnType["results"];
      gasUsed?: bigint;
    }
  | {
      success: false;
      error: string;
      reverted: boolean;
    };

export type SimulatedQuote = Quote & {
  simulation: SimulationResult;
};
