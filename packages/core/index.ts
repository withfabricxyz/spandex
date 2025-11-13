import { ZeroXAggregator } from "./lib/aggregators/0x.js";
import { FabricAggregator } from "./lib/aggregators/fabric.js";
import { KyberAggregator } from "./lib/aggregators/kyber.js";
import { OdosAggregator } from "./lib/aggregators/odos.js";
import { MetaAggregator } from "./lib/meta_aggregator.js";
import type { AggregatorConfig, MetaAggregatorConfig } from "./lib/types.js";

/**
 * A default MetaAggregator instance with common, high performing providers configured. This may change over time.
 *
 * @returns A MetaAggregator instance with default providers configured.
 */
export function defaultMetaAggregator(): MetaAggregator {
  const aggregators: AggregatorConfig[] = [
    {
      provider: "fabric",
      config: {},
    },
    {
      provider: "kyberswap",
      config: {
        clientId: "smal",
      },
    },
    {
      provider: "odos",
      config: {},
    },
  ];

  return buildMetaAggregator({
    aggregators,
  });
}

/**
 * Example:
 * const metaAggregator = buildMetaAggregator({
 *   providers: [
 *    { provider: "fabric" },
 *    { provider: "0x", apiKey: "..." },
 *    { provider: "odos" },
 *   ],
 * });
 *
 * Build a MetaAggregator from the given config to query multiple providers for token swap quotes.
 * @param config - configuration for the meta-aggregator
 * @returns MetaAggregator instance which can fetch quotes from the configured providers
 * @throws Error if an unknown provider is configured or no providers are given
 */
export function buildMetaAggregator(config: MetaAggregatorConfig): MetaAggregator {
  const providers = [];

  for (const agg of config.aggregators) {
    switch (agg.provider) {
      case "0x":
        providers.push(new ZeroXAggregator(agg.config));
        break;
      case "kyberswap":
        providers.push(new KyberAggregator(agg.config));
        break;
      case "fabric":
        providers.push(new FabricAggregator(agg.config));
        break;
      case "odos":
        providers.push(new OdosAggregator(agg.config));
        break;
    }
  }

  return new MetaAggregator(providers, config.defaults);
}

export { MetaAggregator, FabricAggregator, ZeroXAggregator, KyberAggregator, OdosAggregator };
export { Aggregator } from "./lib/aggregator.js";
export type * from "./lib/types.js";
