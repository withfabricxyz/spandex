import type { PublicClient } from "viem";
import { MetaAggregator } from "./lib/aggregator";
import { ZeroXAggregator } from "./lib/aggregators/0x";
import { FabricAggregator } from "./lib/aggregators/fabric";
import { KyberAggregator } from "./lib/aggregators/kyber";
import { OdosAggregator } from "./lib/aggregators/odos";
import type { AggregatorConfig, MetaAggregatorConfig } from "./lib/types";

// Extract required and optional environment variables
const zeroXApiKey = process.env.QUOTER_0X_API_KEY;
const kyberClientId = process.env.QUOTER_KYBERSWAP_CLIENT_ID;

/**
 * A default MetaAggregator instance with common, high performing providers configured. This may change over time.
 *
 * @param client - viem PublicClient for simulation support
 * @returns A MetaAggregator instance with default providers configured.
 */
export function defaultMetaAggregator(client: PublicClient): MetaAggregator {
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
    {
      provider: "odos",
      config: {},
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

  return buildMetaAggregator(
    {
      aggregators,
    },
    client,
  );
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
 * @param client - viem PublicClient for simulation support
 * @returns MetaAggregator instance which can fetch quotes from the configured providers
 */
export function buildMetaAggregator(
  config: MetaAggregatorConfig,
  client: PublicClient,
): MetaAggregator {
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
      default:
        throw new Error("Unknown provider configured");
    }
  }

  if (providers.length > 0) {
    return new MetaAggregator(providers, client);
  }

  return new MetaAggregator([], client);
}

export { simulateSwap } from "./lib/simulation";
export type * from "./lib/types";
