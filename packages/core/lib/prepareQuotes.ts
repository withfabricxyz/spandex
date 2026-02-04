import type { Config } from "./createConfig.js";
import type { AggregationOptions, AggregatorFeature, Quote, SwapParams } from "./types.js";

/**
 * Generates quote promises for all configured aggregators.
 *
 * @param params - Swap request parameters.
 * @returns Array of quote promises to be awaited elsewhere.
 */
export async function prepareQuotes<T>({
  config,
  swap,
  mapFn,
}: {
  config: Config;
  swap: SwapParams;
  mapFn: (quote: Quote) => Promise<T>;
}): Promise<Array<Promise<T>>> {
  // Delegate the quote fetching to a remote server if a proxy is configured
  if (config.proxy !== undefined) {
    return (await config.proxy.prepareQuotes(swap, config.options)).map((a) => a.then(mapFn));
  }

  const options = config.options;

  // Required features for this request (hard filters)
  const requiredFeatures = queryFeatures(swap);
  // Requested fee/surplus features used to annotate quotes for preference sorting
  const requestedFeeFeatures = feeFeatures(options);
  const candidates = config.aggregators.filter((aggregator) =>
    aggregator.supportsAllFeatures(requiredFeatures),
  );
  if (candidates.length === 0) {
    throw new Error(
      `No aggregators available that support all required features: ${requiredFeatures.join(", ")}. Consider adjusting your MetaAggregator configuration or request parameters.`,
    );
  }

  return candidates.map((aggregator) =>
    aggregator
      .fetchQuote(swap, options)
      .then((quote) => attachActivatedFeatures(quote, aggregator, requestedFeeFeatures))
      .then(mapFn),
  );
}

function feeFeatures(options?: AggregationOptions): AggregatorFeature[] {
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

function attachActivatedFeatures(
  quote: Quote,
  aggregator: { supportsFeature: (feature: AggregatorFeature) => boolean },
  requestedFeeFeatures: AggregatorFeature[],
): Quote {
  if (!quote.success || requestedFeeFeatures.length === 0) {
    return quote;
  }
  const activatedFeatures = requestedFeeFeatures.filter((feature) =>
    aggregator.supportsFeature(feature),
  );
  return { ...quote, activatedFeatures };
}
