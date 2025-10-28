import { MetaAggregator } from "./lib/aggregator";
import { ZeroXAggregator } from "./lib/aggregators/0x";
import { FabricAggregator } from "./lib/aggregators/fabric";
import { KyberAggregator } from "./lib/aggregators/kyber";
import type { AggregatorConfig, MetaAggregatorConfig } from "./lib/types";

// Extract required and optional environment variables
const zeroXApiKey = process.env.QUOTER_0X_API_KEY;
const kyberClientId = process.env.QUOTER_KYBERSWAP_CLIENT_ID;

/**
 * A default MetaAggregator instance with common, high performing providers configured. This may change over time.
 *
 * @returns A MetaAggregator instance with default providers configured.
 */
export function defaultMetaAggregator() {
  const aggregators: AggregatorConfig[] = [
    {
      provider: "fabric",
      config: {},
    },
    {
      provider: "kyberswap",
      config: {
        clientId: kyberClientId || "smal",
      },
    },
  ];

  if (zeroXApiKey) {
    aggregators.push({
      provider: "0x",
      config: {
        apiKey: zeroXApiKey,
      },
    });
  }

  return buildMetaAggregator({
    aggregators,
  });
}

/**
 * Example:
 * const metaAggregator = buildMetaAggregator({
 *   providers: [
 *    { provider: "fabric" },
 *    { provider: "0x", apiKey: process.env.ZEROX_API_KEY },
 *    { provider: "kyberswap" },
 *   ],
 * });
 *
 * Build a MetaAggregator from the given config to query multiple providers for token swap quotes.
 * @param config - configuration for the meta-aggregator
 * @returns MetaAggregator instance which can fetch quotes from the configured providers
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
      default:
        throw new Error(`Unknown provider configured`);
    }
  }

  if (providers.length > 0) {
    return new MetaAggregator(providers);
  }

  return new MetaAggregator([]);
}

export type * from "./lib/types";
