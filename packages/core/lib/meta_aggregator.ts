import type { Aggregator } from "./aggregator.ts";
import { applyStrategy } from "./strategies.js";
import type { MetaAggregationOptions, Quote, SuccessfulQuote, SwapParams } from "./types.js";

const MIN_DEADLINE_MS = 100;
const MAX_DEADLINE_MS = 60_000;

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
      this.prepareQuotes(params, overrides),
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
    const quotes = await Promise.all(this.prepareQuotes(params, overrides));
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
    return Promise.all(this.prepareQuotes(params, overrides));
  }

  /**
   * Generates quote promises for all configured aggregators, respecting deadline overrides.
   *
   * @param params - Swap request parameters.
   * @param overrides - Per-request options that override defaults.
   * @returns Array of quote promises to be awaited elsewhere.
   */
  prepareQuotes(params: SwapParams, overrides?: MetaAggregationOptions): Array<Promise<Quote>> {
    const options = { ...this.defaults, ...overrides };
    const deadlineMs = options.deadlineMs;
    const deadlineSignal = createDeadlineSignal(deadlineMs);

    return this.aggregators.map(async (aggregator) => {
      const quotePromise = aggregator.fetchQuote(params, options);
      if (!deadlineSignal) {
        return quotePromise;
      }

      const deadline = deadlineMs ?? 0;
      return Promise.race([
        quotePromise,
        deadlineSignal.then<Quote>(() => ({
          success: false,
          provider: aggregator.name(),
          message: `MetaAggregator deadline exceeded after ${deadline}ms`,
        })),
      ]);
    });
  }
}

function createDeadlineSignal(deadlineMs?: number): Promise<void> | undefined {
  return deadlineMs !== undefined
    ? new Promise((resolve) => {
        setTimeout(resolve, Math.min(Math.max(deadlineMs, MIN_DEADLINE_MS), MAX_DEADLINE_MS));
      })
    : undefined;
}
