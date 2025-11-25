import type { MetaAggregator, Quote, SwapParams } from "@withfabric/smal";
import type { PublicClient } from "viem";
import { simulateQuote } from "./simulation.js";
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
    const mapFn = async (quote: Quote): Promise<SimulatedQuote> => {
      return simulateQuote({
        client: this.client,
        params,
        quote,
      });
    };

    return this.metaAggregator.fetchAndThen<SimulatedQuote>({
      params,
      mapFn,
    });
  }
}
