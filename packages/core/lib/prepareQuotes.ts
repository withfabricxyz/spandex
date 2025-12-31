import type { Config } from "./createConfig.js";
import type { AggregationOptions, AggregatorFeature, Quote, SwapParams } from "./types.js";

/**
 * Generates quote promises for all configured aggregators.
 *
 * @param params - Swap request parameters.
 * @returns Array of quote promises to be awaited elsewhere.
 */
export function prepareQuotes<T>({
  config,
  swap,
  mapFn,
}: {
  config: Config;
  swap: SwapParams;
  mapFn: (quote: Quote) => Promise<T>;
}): Array<Promise<T>> {
  const options = config.options;

  // Get the required features for this request and filter aggregators accordingly
  const features = [...queryFeatures(swap), ...configFeatures(options)];
  const candidates = config.aggregators.filter((aggregator) =>
    aggregator.supportsAllFeatures(features),
  );
  if (candidates.length === 0) {
    throw new Error(
      `No aggregators available that support all required features: ${features.join(", ")}. Consider adjusting your MetaAggregator configuration or request parameters.`,
    );
  }

  return candidates.map((aggregator) => aggregator.fetchQuote(swap, options).then(mapFn));
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
