import type { Aggregator } from "./aggregator.ts";
import { applyStrategy } from "./strategies.js";
import {
  type MetaAggregationOptions,
  type Quote,
  QuoteError,
  type SuccessfulQuote,
  type SwapParams,
} from "./types.js";

const MIN_DEADLINE_MS = 100;
const MAX_DEADLINE_MS = 60_000;

const QuoteIdentifyFn = async (quote: Quote): Promise<Quote> => quote;

/**
 * Coordinates multiple aggregators and applies strategies to surface the best quote.
 */
export class MetaAggregator {
  /**
   * @param aggregators - Providers that will be queried when fetching quotes.
   * @param defaults - Default aggregation configuration shared across requests.
   * @throws Error if no aggregators are supplied.
   */
  constructor(
    private aggregators: Aggregator[],
    public readonly defaults?: MetaAggregationOptions,
  ) {
    if (aggregators.length === 0) {
      throw new Error("MetaAggregator requires at least one aggregator");
    }
  }

  /**
   * Read-only list of provider identifiers configured on this meta-aggregator.
   */
  get providers(): string[] {
    return this.aggregators.map((a) => a.name());
  }

  /**
   * Fetches quotes and applies the configured strategy to pick the best result.
   *
   * @param params - Swap request parameters.
   * @param overrides - Per-request options that override defaults.
   * @returns Winning quote, or `null` if no provider succeeds.
   */
  async fetchBestQuote(
    params: SwapParams,
    overrides?: MetaAggregationOptions,
  ): Promise<SuccessfulQuote | null> {
    return applyStrategy(
      overrides?.strategy ?? this.defaults?.strategy ?? "quotedPrice",
      this.prepareQuotes({ params, overrides, mapFn: QuoteIdentifyFn }),
    );
  }

  /**
   * Fetches quotes from all providers and returns only the successful ones.
   *
   * @param params - Swap request parameters.
   * @param overrides - Per-request options that override defaults.
   * @returns Successful quotes in the order providers resolve.
   */
  async fetchQuotes(
    params: SwapParams,
    overrides?: MetaAggregationOptions,
  ): Promise<SuccessfulQuote[]> {
    const quotes = await Promise.all(
      this.prepareQuotes({ params, overrides, mapFn: QuoteIdentifyFn }),
    );
    return quotes.filter((q) => q.success) as SuccessfulQuote[];
  }

  /**
   * Fetches quotes from all providers and returns every result, including failures.
   *
   * @param params - Swap request parameters.
   * @param overrides - Per-request options that override defaults.
   * @returns Array of successful or failed quote responses.
   */
  async fetchAllQuotes(params: SwapParams, overrides?: MetaAggregationOptions): Promise<Quote[]> {
    return Promise.all(this.prepareQuotes({ params, overrides, mapFn: QuoteIdentifyFn }));
  }

  /**
   * Fetches quotes from all providers and returns every result, including failures, mapped through a provided function.
   *
   * This is useful for performing additional processing on each quote as it is fetched, but still adhering to the meta-aggregator's deadline handling.
   *
   * @param params - Swap request parameters.
   * @param overrides - Per-request options that override defaults.
   * @returns Array of successful or failed quote responses.
   */
  async fetchAllAndThen<T>({
    params,
    overrides,
    mapFn,
  }: {
    params: SwapParams;
    mapFn: (quote: Quote) => Promise<T>;
    overrides?: MetaAggregationOptions;
  }): Promise<T[]> {
    return Promise.all(this.prepareQuotes({ params, overrides, mapFn }));
  }

  /**
   * Generates quote promises for all configured aggregators, respecting deadline overrides.
   *
   * @param params - Swap request parameters.
   * @param overrides - Per-request options that override defaults.
   * @returns Array of quote promises to be awaited elsewhere.
   */
  prepareQuotes<T>({
    params,
    overrides,
    mapFn,
  }: {
    params: SwapParams;
    mapFn: (quote: Quote) => Promise<T>;
    overrides?: MetaAggregationOptions;
  }): Array<Promise<T>> {
    const options = { ...this.defaults, ...overrides }; // TODO: Deep merge?

    return this.aggregators.map(async (aggregator) => {
      const quotePromise = aggregator.fetchQuote(params, options).then(mapFn);
      if (!options.deadlineMs) {
        return quotePromise;
      }

      return Promise.race([
        quotePromise,
        deadline({ deadlineMs: options.deadlineMs, aggregator, mapFn }),
      ]);
    });
  }
}

async function deadline<T>({
  deadlineMs,
  aggregator,
  mapFn,
}: {
  deadlineMs: number;
  aggregator: Aggregator;
  mapFn: (quote: Quote) => Promise<T>;
}): Promise<T> {
  await new Promise((resolve) =>
    setTimeout(resolve, Math.min(Math.max(deadlineMs, MIN_DEADLINE_MS), MAX_DEADLINE_MS)),
  );
  return mapFn({
    success: false,
    provider: aggregator.name(),
    error: new QuoteError(`MetaAggregator deadline exceeded after ${deadlineMs}ms`, ""),
  });
}
