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
    };
