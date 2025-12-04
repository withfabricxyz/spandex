import type { MetaAggregator, Quote, SwapParams } from "@withfabric/smal";
import type { Client, PublicClient } from "viem";
import { simulateQuote } from "./simulation.js";
import type { SimulatedQuote } from "./types.js";

/**
 * Wrapper around {@link MetaAggregator} that automatically simulates each fetched quote.
 *
 * @public
 */
export class SimulatedMetaAggregator {
  private clients: Record<number, Client>;
  /**
   * @param metaAggregator - Quote source that provides raw routes per provider.
   * @param clients - Public Viem clients used to execute simulations. One per chain used.
   */
  constructor(
    private metaAggregator: MetaAggregator,
    clients: PublicClient[],
  ) {
    this.clients = clients.reduce(
      (acc, client) => {
        if (!client.chain?.id) {
          throw new Error("Provided PublicClient is missing chain ID");
        }
        acc[client.chain.id] = client;
        return acc;
      },
      {} as Record<number, Client>,
    );
  }

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
    const client = this.clients[params.chainId];
    if (!client) {
      throw new Error(
        `No PublicClient configured for chainId ${params.chainId}. Please provide a client via options or constructor.`,
      );
    }

    const mapFn = async (quote: Quote): Promise<SimulatedQuote> => {
      return simulateQuote({
        client: client as PublicClient,
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
