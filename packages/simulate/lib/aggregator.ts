import type { MetaAggregator } from "@withfabric/smal";
import type { SwapParams } from "@withfabric/smal/lib/types";
import type { PublicClient } from "viem";
import { simulateQuotes } from "./simulation.js";
import type { SimulatedQuote } from "./types.js";

export class SimulatedMetaAggregator {
  constructor(
    private metaAggregator: MetaAggregator,
    private client: PublicClient,
  ) {}

  get providers(): string[] {
    return this.metaAggregator.providers;
  }

  async fetchQuotes(params: SwapParams): Promise<SimulatedQuote[]> {
    const quotes = await this.metaAggregator.fetchAllQuotes(params);

    return simulateQuotes({
      client: this.client,
      quotes,
      params,
    });
  }
}
