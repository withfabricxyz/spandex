import type { Aggregator } from "./aggregator.ts";
import { applyStrategy } from "./strategies.js";
import type {
  AggregationOptions,
  AggregatorFeature,
  Quote,
  QuoteSelectionStrategy,
  SuccessfulQuote,
  SwapParams,
} from "./types.js";

const QuoteIdentifyFn = async (quote: Quote): Promise<Quote> => quote;

/**
 * Coordinates multiple aggregators and applies strategies to surface the best quote.
 */
export class MetaAggregator {
  public readonly options: AggregationOptions;
  /**
   * @param aggregators - Providers that will be queried when fetching quotes.
   * @param options - Default aggregation configuration shared across requests.
   * @throws Error if no aggregators are supplied.
   */
  constructor(
    private aggregators: Aggregator[],
    options?: AggregationOptions,
  ) {
    if (aggregators.length === 0) {
      throw new Error("MetaAggregator requires at least one aggregator");
    }
    this.options = options ?? {};
    validateOptions(this.options);
  }

  /**
   * Creates a new MetaAggregator instance with the same aggregators but overridden options.
   *
   * @param options - New aggregation options to apply.
   * @returns Cloned MetaAggregator with patched options.
   */
  clone(options?: AggregationOptions): MetaAggregator {
    return new MetaAggregator(this.aggregators, {
      ...this.options,
      ...options,
    });
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
   * @param strategy - Strategy used to rank and select the winning quote.
   * @returns Winning quote, or `null` if no provider succeeds.
   */
  async fetchBestQuote(
    params: SwapParams,
    strategy: QuoteSelectionStrategy,
  ): Promise<SuccessfulQuote | null> {
    return applyStrategy(strategy, this.prepareQuotes({ params, mapFn: QuoteIdentifyFn }));
  }

  /**
   * Fetches quotes from all providers and returns only the successful ones.
   *
   * @param params - Swap request parameters.
   * @returns Successful quotes in the order providers resolve.
   */
  async fetchSuccessfulQuotes(params: SwapParams): Promise<SuccessfulQuote[]> {
    const quotes = await Promise.all(this.prepareQuotes({ params, mapFn: QuoteIdentifyFn }));
    return quotes.filter((q) => q.success) as SuccessfulQuote[];
  }

  /**
   * Fetches quotes from all providers and returns every result, including failures.
   *
   * @param params - Swap request parameters.
   * @returns Array of successful or failed quote responses.
   */
  async fetchQuotes(params: SwapParams): Promise<Quote[]> {
    return Promise.all(this.prepareQuotes({ params, mapFn: QuoteIdentifyFn }));
  }

  /**
   * Fetches quotes from all providers and returns every result, including failures, mapped through a provided function.
   *
   * This is useful for performing additional processing on each quote as it is fetched, but still adhering to the meta-aggregator's deadline handling.
   *
   * @param params - Swap request parameters.
   * @returns Array of successful or failed quote responses.
   */
  async fetchAndThen<T>({
    params,
    mapFn,
  }: {
    params: SwapParams;
    mapFn: (quote: Quote) => Promise<T>;
  }): Promise<T[]> {
    return Promise.all(this.prepareQuotes({ params, mapFn }));
  }

  /**
   * Generates quote promises for all configured aggregators.
   *
   * @param params - Swap request parameters.
   * @returns Array of quote promises to be awaited elsewhere.
   */
  prepareQuotes<T>({
    params,
    mapFn,
  }: {
    params: SwapParams;
    mapFn: (quote: Quote) => Promise<T>;
  }): Array<Promise<T>> {
    const options = this.options;

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

    return candidates.map((aggregator) => aggregator.fetchQuote(params, options).then(mapFn));
  }
}

function validateOptions(options: AggregationOptions): void {
  if (
    ((options.integratorSwapFeeBps || 0) > 0 || (options.integratorSurplusBps || 0) > 0) &&
    !options.integratorFeeAddress
  ) {
    throw new Error(
      "Swap fees or surplus bps provided without an integrator fee address. Set `integratorFeeAddress` in AggregationOptions.",
    );
  }
  if (
    options.integratorFeeAddress &&
    !options.integratorSwapFeeBps &&
    !options.integratorSurplusBps
  ) {
    throw new Error(
      "Integrator fee address provided without swap fees or surplus bps. Set `integratorSwapFeeBps` or `integratorSurplusBps` in AggregationOptions.",
    );
  }
}

function configFeatures(options?: AggregationOptions): AggregatorFeature[] {
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
  if (params.mode === "exactIn") {
    features.push("exactIn");
  } else if (params.mode === "targetOut") {
    features.push("targetOut");
  }
  return features;
}
