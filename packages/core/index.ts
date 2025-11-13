import { ZeroXAggregator } from "./lib/aggregators/0x.js";
import { FabricAggregator } from "./lib/aggregators/fabric.js";
import { KyberAggregator } from "./lib/aggregators/kyber.js";
import { OdosAggregator } from "./lib/aggregators/odos.js";
import { MetaAggregator } from "./lib/meta_aggregator.js";
import type { AggregatorConfig, MetaAggregatorConfig } from "./lib/types.js";

/**
 * Creates a MetaAggregator pre-configured with a curated set of high-performing providers.
 *
 * The default configuration may evolve over time as providers are added or removed.
 *
 * @returns MetaAggregator instance with default providers configured.
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
 * Builds a MetaAggregator from the given configuration so multiple providers can be queried for
 * token swap quotes.
 *
 * @param config - Configuration for the meta-aggregator.
 * @returns MetaAggregator instance that can fetch quotes from the configured providers.
 * @throws Error if no providers are configured.
 *
 * @example
 * ```ts
 * const meta = buildMetaAggregator({
 *   aggregators: [
 *     { provider: "fabric", config: {} },
 *     { provider: "0x", config: { apiKey: "..." } },
 *     { provider: "odos", config: {} },
 *   ],
 * });
 * ```
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
