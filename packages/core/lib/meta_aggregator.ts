import type { Aggregator } from "./aggregator.ts";
import { applyStrategy } from "./strategies.js";
import {
  type AggregatorFeature,
  type MetaAggregationOptions,
  type Quote,
  QuoteError,
  type SuccessfulQuote,
  type SwapParams,
} from "./types.js";

const MIN_DEADLINE_MS = 250;
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

    validateOptions(options);

    // Get the required features for this request and filter aggregators accordingly
    const features = [...queryFeatures(params), ...configFeatures(options)];
    const candidates = this.aggregators.filter((a) =>
      features.every((f) => a.features().includes(f)),
    );
    if (candidates.length === 0) {
      throw new Error(
        `No aggregators available that support all required features: ${features.join(", ")}. Consider adjusting your MetaAggregator configuration or request parameters.`,
      );
    }

    return candidates.map(async (aggregator) => {
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

function validateOptions(options: MetaAggregationOptions): void {
  if (
    ((options.integratorSwapFeeBps || 0) > 0 || (options.integratorSurplusBps || 0) > 0) &&
    !options.integratorFeeAddress
  ) {
    throw new Error(
      "Swap fees or surplus bps provided without an integrator fee address. Set `integratorFeeAddress` in MetaAggregationOptions.",
    );
  }
  if (
    options.integratorFeeAddress &&
    !options.integratorSwapFeeBps &&
    !options.integratorSurplusBps
  ) {
    throw new Error(
      "Integrator fee address provided without swap fees or surplus bps. Set `integratorSwapFeeBps` or `integratorSurplusBps` in MetaAggregationOptions.",
    );
  }
}

function configFeatures(options?: MetaAggregationOptions): AggregatorFeature[] {
  const features: AggregatorFeature[] = [];
  if ((options?.integratorSwapFeeBps || 0) > 0) {
    features.push("integratorFees");
  }
  if ((options?.integratorSurplusBps || 0) > 0) {
    features.push("integratorSurplus");
  }
  return features;
}

function queryFeatures(params: SwapParams): AggregatorFeature[] {
  const features: AggregatorFeature[] = [];
  if (params.mode === "exactInQuote") {
    features.push("exactInQuote");
  } else if (params.mode === "exactOutputQuote") {
    features.push("targetOutQuote");
  }
  return features;
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
