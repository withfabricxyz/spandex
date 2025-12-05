import { ZeroXAggregator } from "./lib/aggregators/0x.js";
import { FabricAggregator } from "./lib/aggregators/fabric.js";
import { KyberAggregator } from "./lib/aggregators/kyber.js";
import { OdosAggregator } from "./lib/aggregators/odos.js";
import { MetaAggregator } from "./lib/meta_aggregator.js";
import type { MetaAggregatorConfig } from "./lib/types.js";

/**
 * Creates a MetaAggregator pre-configured with a curated set of high-performing providers.
 *
 * The default configuration may evolve over time as providers are added or removed.
 *
 * @returns MetaAggregator instance with default providers configured.
 */
export function defaultMetaAggregator(): MetaAggregator {
  return buildMetaAggregator({
    providers: {
      fabric: {},
      kyberswap: {
        clientId: "smal",
      },
      odos: {},
    },
  });
}

/**
 * Builds a MetaAggregator from the given configuration so multiple providers can be queried for
 * token swap quotes.
 *
 * @param config - Configuration for the MetaAggregator including providers and options.
 * @returns Configured MetaAggregator instance.
 *
 * @example
 * ```ts
 * const metaAggregator = buildMetaAggregator({
 *   providers: {
 *     "0x": { apiKey: "your-0x-api-key" },
 *     kyberswap: { clientId: "your-kyberswap-client-id" },
 *   },
 *   options: {
 *     deadlineMs: 10000,
 *   },
 * });
 * ```
 */
export function buildMetaAggregator(config: MetaAggregatorConfig): MetaAggregator {
  const providers = [];

  const configured = config.providers;
  if (configured["0x"]) {
    providers.push(new ZeroXAggregator(configured["0x"]));
  }
  if (configured.kyberswap) {
    providers.push(new KyberAggregator(configured.kyberswap));
  }
  if (configured.fabric) {
    providers.push(new FabricAggregator(configured.fabric));
  }
  if (configured.odos) {
    providers.push(new OdosAggregator(configured.odos));
  }

  return new MetaAggregator(providers, config.options, config.clientLookup);
}

export { MetaAggregator, FabricAggregator, ZeroXAggregator, KyberAggregator, OdosAggregator };
export { Aggregator } from "./lib/aggregator.js";
export { ExecutionError, executeBestQuote } from "./lib/execution/index.js";
export { SimulationRevertError, simulateQuote, simulateQuotes } from "./lib/simulation/index.js";
export type * from "./lib/types.js";
