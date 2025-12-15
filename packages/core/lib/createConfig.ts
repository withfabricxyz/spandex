import type { PublicClient } from "viem";
import { ZeroXAggregator } from "./aggregators/0x.js";
import { FabricAggregator } from "./aggregators/fabric.js";
import type { Aggregator } from "./aggregators/index.js";
import { KyberAggregator } from "./aggregators/kyber.js";
import { OdosAggregator } from "./aggregators/odos.js";
import { RelayAggregator } from "./aggregators/relay.js";
import type { AggregationOptions, ConfigParams } from "./types.js";

/**
 * Configuration used in various library functions.
 */
export type Config = {
  /** Function to lookup a PublicClient for a given chain ID. */
  clientLookup: (chainId: number) => PublicClient | undefined;
  /** Global options applied to all aggregators and requests. */
  options: AggregationOptions;
  /** Instantiated aggregators based on the provided configuration. */
  aggregators: Aggregator[];
};

/**
 * Provides a standard set of default providers for quick setup.
 *
 * @param params.appId - Id used to identify your application to providers that require it.
 *
 * @returns Provider configuration object with default providers enabled.
 */
export function defaultProviders(params: { appId: string }): ConfigParams["providers"] {
  return {
    kyberswap: { clientId: params.appId },
    fabric: {},
    odos: {},
  };
}

/**
 * Creates valid configuration for executing meta aggregation functions.
 *
 * @param params - Configuration for meta aggregation including providers and options.
 *
 * @returns Config object for use with library functions
 *
 * @example
 * ```ts
 * const config = createConfig({
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
export function createConfig(params: ConfigParams): Config {
  if (Object.keys(params.providers).length === 0) {
    throw new Error(
      "At least one provider must be configured in createConfig. You can also use defaultProviders({ appId: 'my-app-id' }) to get a standard set of providers.",
    );
  }

  const aggregators = [];

  const configured = params.providers;
  if (configured["0x"]) {
    aggregators.push(new ZeroXAggregator(configured["0x"]));
  }
  if (configured.kyberswap) {
    aggregators.push(new KyberAggregator(configured.kyberswap));
  }
  if (configured.fabric) {
    aggregators.push(new FabricAggregator(configured.fabric));
  }
  if (configured.odos) {
    aggregators.push(new OdosAggregator(configured.odos));
  }
  if (configured.relay) {
    aggregators.push(new RelayAggregator(configured.relay));
  }

  validateOptions(params.options || {});

  // Build client lookup function
  let clientLookup: (chainId: number) => PublicClient | undefined = () => undefined;
  if (params.clients !== undefined) {
    if (typeof params.clients === "function") {
      clientLookup = params.clients;
    } else if (Array.isArray(params.clients)) {
      clientLookup = (chainId: number) =>
        (params.clients as PublicClient[]).find((c) => c.chain?.id === chainId);
    }
  }

  return {
    options: params.options || {},
    clientLookup,
    aggregators,
  };
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
