import type { MetaAggregator } from "@withfabric/smal";
import type { SuccessfulQuote, SwapParams } from "@withfabric/smal/lib/types";
import type { PublicClient } from "viem";
import { simulateSwap } from "../simulation.js";
import type { SimulationResult } from "./types.js";

export type SimulatedQuote = SuccessfulQuote & {
  simulation: SimulationResult;
};

export class SimulatedMetaAggregator {
  constructor(
    private metaAggregator: MetaAggregator,
    private client: PublicClient,
  ) {}

  get providers(): string[] {
    return this.metaAggregator.providers;
  }

  async fetchQuotes(params: SwapParams): Promise<SimulatedQuote[]> {
    const quotes = await this.metaAggregator.fetchQuotes(params);

    const simulatedQuotes = await Promise.all(
      quotes.map(async (quote: SuccessfulQuote) => {
        const simulation = await simulateSwap(this.client, {
          from: params.swapperAccount,
          to: quote.txData.to,
          data: quote.txData.data,
          value: quote.txData.value,
          tokenIn: params.inputToken,
          tokenOut: params.outputToken,
          amountIn: params.inputAmount,
        });

        return {
          ...quote,
          simulation,
        };
      }),
    );

    return simulatedQuotes;
  }
}
