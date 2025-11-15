import type { MetaAggregator } from "@withfabric/smal";
import type { SwapParams } from "@withfabric/smal/lib/types";
import type { PublicClient } from "viem";
import { simulateQuotes } from "./simulation.js";
import type { SimulatedQuote } from "./types.js";

/**
 * Wrapper around {@link MetaAggregator} that automatically simulates each fetched quote.
 *
 * @public
 */
export class SimulatedMetaAggregator {
  /**
   * @param metaAggregator - Quote source that provides raw routes per provider.
   * @param client - Public Viem client used to execute simulations.
   */
  constructor(
    private metaAggregator: MetaAggregator,
    private client: PublicClient,
  ) {}

  /**
   * Provider identifiers exposed by the underlying {@link MetaAggregator}.
   *
   * @returns List of provider identifiers exposed by the wrapped aggregator.
   */
  get providers(): string[] {
    return this.metaAggregator.providers;
  }

  /**
   * Fetch quotes for the provided params and simulate them using the configured client.
   *
   * @param params - Swap parameters describing the trade request.
   * @returns Quotes enhanced with simulation metadata.
   */
  async fetchQuotes(params: SwapParams): Promise<SimulatedQuote[]> {
    const quotes = await this.metaAggregator.fetchAllQuotes(params);

    return simulateQuotes({
      client: this.client,
      quotes,
      params,
    });
  }
}
