import { applyStrategy } from "./strategies.ts";
import type {
  MetaAggregationOptions,
  ProviderKey,
  Quote,
  QuoteError,
  SuccessfulQuote,
  SwapParams,
} from "./types.js";

export abstract class Aggregator {
  protected abstract tryFetchQuote(params: SwapParams): Promise<SuccessfulQuote>;
  abstract name(): ProviderKey;

  async fetchQuote(params: SwapParams): Promise<Quote> {
    try {
      const start = performance.now();
      const quote = await this.tryFetchQuote(params);
      const stop = performance.now();
      return {
        ...quote,
        latency: stop - start,
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name(),
        error: error as QuoteError,
      };
    }
  }
}

export class MetaAggregator {
  constructor(
    private aggregators: Aggregator[],
    public readonly defaults?: MetaAggregationOptions,
  ) {}

  get providers(): string[] {
    return this.aggregators.map((a) => a.name());
  }

  async fetchBestQuote(
    params: SwapParams,
    overrides?: MetaAggregationOptions,
  ): Promise<SuccessfulQuote | null> {
    return applyStrategy(
      overrides?.strategy ?? this.defaults?.strategy ?? "quotedPrice",
      this.fetchAllQuotes(params),
    );
  }

  async fetchQuotes(params: SwapParams): Promise<SuccessfulQuote[]> {
    const quotes = await Promise.all(this.fetchAllQuotes(params));
    const successfulQuotes = quotes.filter((q) => q.success) as SuccessfulQuote[];

    return successfulQuotes.sort((a, b) => {
      return Number(b.outputAmount - a.outputAmount);
    });
  }

  /*
   * Generate quote promises for all configured aggregators
   * @param params Swap parameters
   * @returns Array of Promises resolving to Quote
   */
  fetchAllQuotes(params: SwapParams): Array<Promise<Quote>> {
    // TODO: Pass important options like timeouts, retries, etc.
    return this.aggregators.map(async (aggregator) => {
      return aggregator.fetchQuote(params);
    });
  }
}
