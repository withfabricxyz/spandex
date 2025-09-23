import { MetaAggregator } from "./lib/aggregator";
import type { MetaAggregatorConfig, ProviderConfig } from "./lib/types";
import { LifiAggregator } from "./lib/aggregators/lifi";
import { ZeroXAggregator } from "./lib/aggregators/0x";
import { KyberAggregator } from "./lib/aggregators/kyber";
import { FabricAggregator } from "./lib/aggregators/fabric";

// Extract required and optional environment variables
const zeroXApiKey = process.env.QUOTER_0X_API_KEY;
const kyberClientId = process.env.QUOTER_KYBERSWAP_CLIENT_ID;

/**
 * A default MetaAggregator instance with common, high performing providers configured. This may change over time.
 *
 * @returns A MetaAggregator instance with default providers configured.
 */
export function defaultMetaAggregator() {
  const providers: ProviderConfig[] = [{
    provider: "fabric",
  }, {
    provider: "kyberswap",
    clientId: kyberClientId || "swap-quoter",
  }];

  if (zeroXApiKey) {
    providers.push({
      provider: "0x",
      apiKey: zeroXApiKey,
    });
  }

  return buildMetaAggregator({
    providers,
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

  for (const providerConfig of config.providers) {
    switch (providerConfig.provider) {
      case "lifi":
        providers.push(new LifiAggregator(providerConfig));
        break;
      case "0x":
        providers.push(new ZeroXAggregator(providerConfig));
        break;
      case "kyberswap":
        providers.push(new KyberAggregator(providerConfig));
        break;
      case "fabric":
        providers.push(new FabricAggregator(providerConfig));
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