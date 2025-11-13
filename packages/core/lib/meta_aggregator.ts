import type { Aggregator } from "./aggregator.ts";
import { applyStrategy } from "./strategies.js";
import type { MetaAggregationOptions, Quote, SuccessfulQuote, SwapParams } from "./types.js";

const MIN_DEADLINE_MS = 100;
const MAX_DEADLINE_MS = 60_000;

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
      this.prepareQuotes(params, overrides),
    );
  }

  async fetchQuotes(
    params: SwapParams,
    overrides?: MetaAggregationOptions,
  ): Promise<SuccessfulQuote[]> {
    const quotes = await Promise.all(this.prepareQuotes(params, overrides));
    return quotes.filter((q) => q.success) as SuccessfulQuote[];
  }

  async fetchAllQuotes(params: SwapParams, overrides?: MetaAggregationOptions): Promise<Quote[]> {
    return Promise.all(this.prepareQuotes(params, overrides));
  }

  /*
   * Generate quote promises for all configured aggregators
   * @param params Swap parameters
   * @returns Array of Promises resolving to Quote
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
