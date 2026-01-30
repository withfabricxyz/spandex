import type { PublicClient } from "viem";
import { simulateQuote } from "../index.js";
import type { Config } from "./createConfig.js";
import type {
  AggregationOptions,
  AggregatorFeature,
  Quote,
  SimulatedQuote,
  SwapParams,
} from "./types.js";

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

/**
 * Prepares simulated quotes by fetching quotes from all configured aggregators then simulating them.
 *
 * @param params - Request parameters.
 * @param params.config - Meta-aggregator configuration.
 * @param params.swap - Swap request parameters.
 * @param params.client - Public client used to simulate quote transaction data.
 * @returns Quotes enriched with simulation metadata.
 */
export async function prepareSimulatedQuotes({
  config,
  swap,
  client,
}: {
  config: Config;
  swap: SwapParams;
  client?: PublicClient;
}): Promise<Promise<SimulatedQuote>[]> {
  const resolved = client ?? config.clientLookup(swap.chainId);
  if (!resolved) {
    throw new Error(
      `No PublicClient provided or configured for chainId ${swap.chainId}. Please provide a client via options or constructor.`,
    );
  }

  const mapFn = async (quote: Quote): Promise<SimulatedQuote> => {
    return simulateQuote({
      client: resolved as PublicClient,
      swap,
      quote,
    });
  };

  return await prepareQuotes({ config, swap, mapFn });
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
