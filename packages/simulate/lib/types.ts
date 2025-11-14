import type { Quote, QuoteTxData } from "@withfabric/smal";
import type { Block, SimulateCallsReturnType } from "viem";

export class SimulationRevertError extends Error {
  constructor(
    public readonly failures: {
      call: QuoteTxData;
      result: SimulateCallsReturnType["results"][0];
    }[],
    public readonly block: Block,
  ) {
    let message = `\n\nSimulation reverted on the following calls (block=${block.number}):\n`;
    for (const failure of failures) {
      message += `Call to ${failure.call.to} with data: \n`;
      message += `${failure.call.data}\n\n`;

      message += `Revert return data: \n`;
      message += `${failure.result.data}\n`;
      message += failure.result.error ? `Error: ${failure.result.error.message}\n\n` : "\n\n";
    }
    super(message);
  }
}

export type SimulationResult =
  | {
      success: true;
      outputAmount: bigint;
      callsResults: SimulateCallsReturnType["results"];
      gasUsed?: bigint;
      latency: number;
      blockNumber: bigint | null;
    }
  | {
      success: false;
      error: Error;
    };

export type SimulatedQuote = Quote & {
  simulation: SimulationResult;
};
