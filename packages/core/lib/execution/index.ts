import type { TransactionReceipt, WalletClient } from "viem";
import type { SimulatedQuote, SimulationSuccess, SwapParams } from "../types.js";

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

export type ExecuteBestQuoteParams = {
  // parameters for executing the swap
  params: SwapParams;
  quotes: SimulatedQuote[];
  client: WalletClient;
};

export type ExecutionMetrics = {
  executionTimeMs: number;
  gasUsed: bigint;
  gasPrice: bigint;
};

export type ExecuteBestQuoteReturnType = {
  receipt: TransactionReceipt;
  quote: SimulatedQuote;
  candiates: SimulatedQuote[];
  metrics: ExecutionMetrics;
};

export async function executeBestQuote({
  params,
  quotes,
  client,
}: ExecuteBestQuoteParams): Promise<ExecuteBestQuoteReturnType> {
  if (params.chainId !== client.chain?.id) {
    throw new ExecutionError(
      `Client chain ID ${client.chain?.id} does not match swap chain ID ${params.chainId}`,
    );
  }

  const sorted = quotes
    .filter((q) => q.simulation.success)
    .sort((a, b) => {
      return Number(
        (b.simulation as SimulationSuccess).outputAmount -
          (a.simulation as SimulationSuccess).outputAmount,
      );
    });

  if (sorted.length === 0) {
    throw new ExecutionError("No successful quotes to execute");
  }

  const quote = sorted[0] as SimulatedQuote;
  if (!quote.success) {
    throw new ExecutionError("Selected quote is not successful");
  }

  // TODO: Deal with approvals, etc
  // const hash = await client.sendTransaction({
  //   ...quote.txData,
  //   chainId: params.chainId,
  //   account: params.swapperAccount as `0x${string}`,
  // });

  // // Wait for transaction to be mined
  // const receipt = await client.waitForTransactionReceipt({ hash });

  return {
    receipt: {} as TransactionReceipt,
    quote: quotes[0] as SimulatedQuote,
    candiates: quotes,
    metrics: {
      executionTimeMs: 0,
      gasUsed: BigInt(0),
      gasPrice: BigInt(0),
    },
  };
}
