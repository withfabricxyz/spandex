import { applyStrategy } from "./strategies.js";
import type {
  AggregationOptions,
  MetaAggregationOptions,
  ProviderKey,
  Quote,
  QuoteError,
  SuccessfulQuote,
  SwapParams,
} from "./types.js";

const MIN_RETRIES = 0;
const MAX_RETRIES = 10;
const DEFAULT_RETRIES = 1;
const MIN_INITIAL_DELAY_MS = 20;
const MAX_INITIAL_DELAY_MS = 10_000;
const DEFAULT_INITIAL_DELAY_MS = 500;

export abstract class Aggregator {
  protected abstract tryFetchQuote(params: SwapParams): Promise<SuccessfulQuote>;
  abstract name(): ProviderKey;

  async fetchQuote(params: SwapParams, options?: AggregationOptions): Promise<Quote> {
    const delay = Math.min(
      Math.max(options?.initialRetryDelayMs ?? DEFAULT_INITIAL_DELAY_MS, MIN_INITIAL_DELAY_MS),
      MAX_INITIAL_DELAY_MS,
    );
    const numRetries = Math.min(
      Math.max(options?.numRetries ?? DEFAULT_RETRIES, MIN_RETRIES),
      MAX_RETRIES,
    );

    let numAttempts = 0;
    let error: Quote | null = null;

    while (numAttempts <= numRetries) {
      try {
        const start = performance.now();
        // TODO: Race with a timeout based on options?.timeoutMs
        const quote = await this.tryFetchQuote(params);
        const stop = performance.now();
        return {
          ...quote,
          latency: stop - start,
        };
      } catch (e) {
        error = {
          success: false,
          provider: this.name(),
          error: e as QuoteError,
        };

        // Early terminate to prevent a sleep when we plan to bail
        numAttempts += 1;
        if (numAttempts > numRetries) {
          break;
        }
        // Sleep for delay * 2 ** numAttempts-1 milliseconds before retrying
        await new Promise((resolve) => setTimeout(resolve, delay * 2 ** (numAttempts - 1)));
      }
    }

    return error as Quote;
  }
}

export class MetaAggregator {
  constructor(
    private aggregators: Aggregator[],
    public readonly defaults?: MetaAggregationOptions,
  ) {
    if (aggregators.length === 0) {
      throw new Error("MetaAggregator requires at least one aggregator");
    }
  }

  get providers(): string[] {
    return this.aggregators.map((a) => a.name());
  }

  async fetchBestQuote(
    params: SwapParams,
    overrides?: MetaAggregationOptions,
  ): Promise<SuccessfulQuote | null> {
    return applyStrategy(
      overrides?.strategy ?? this.defaults?.strategy ?? "quotedPrice",
      this.fetchAllQuotes(params, overrides),
    );
  }

  async fetchQuotes(
    params: SwapParams,
    overrides?: MetaAggregationOptions,
  ): Promise<SuccessfulQuote[]> {
    const quotes = await Promise.all(this.fetchAllQuotes(params, overrides));
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
  fetchAllQuotes(params: SwapParams, overrides?: MetaAggregationOptions): Array<Promise<Quote>> {
    const options = { ...this.defaults, ...overrides };

    // TODO: Pass important options like timeouts, retries, etc.
    // Extract the the overides

    return this.aggregators.map(async (aggregator) => {
      return aggregator.fetchQuote(params, options);
    });
  }
}
