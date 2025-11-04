export type SimulationResult =
  | {
      success: true;
      outputAmount: bigint;
      gasUsed?: bigint;
    }
  | {
      success: false;
      error: string;
    };
