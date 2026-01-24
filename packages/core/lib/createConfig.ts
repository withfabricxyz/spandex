import type { PublicClient } from "viem";
import { fabric } from "./aggregators/fabric.js";
import type { Aggregator } from "./aggregators/index.js";
import { kyberswap } from "./aggregators/kyber.js";
import { odos } from "./aggregators/odos.js";
import type {
  AggregationOptions,
  ConfigParams,
  DirectConfigParams,
  ProxyConfigParams,
} from "./types.js";
import type { AggregatorProxy } from "./wire/proxy.js";

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
  /** Proxy configuration or instance */
  proxy?: AggregatorProxy;
};

/**
 * Provides a standard set of default providers for quick setup.
 *
 * @param params.appId - Id used to identify your application to providers that require it.
 *
 * @returns Provider list with default aggregators enabled.
 */
export function defaultProviders(params: { appId: string }): DirectConfigParams["providers"] {
  return [kyberswap({ clientId: params.appId }), fabric({ appId: params.appId }), odos({})];
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
 *   providers: [
 *     zeroX({ apiKey: "your-0x-api-key" }),
 *     kyberswap({ clientId: "your-kyberswap-client-id" }),
 *   ],
 *   options: {
 *     deadlineMs: 10000,
 *   },
 * });
 * ```
 */
export function createConfig(params: ConfigParams): Config {
  if (Object.hasOwn(params, "proxy")) {
    return createProxyConfig(params as ProxyConfigParams);
  }
  return createDirectConfig(params as DirectConfigParams);
}

function createDirectConfig(params: DirectConfigParams): Config {
  if (params.providers.length === 0) {
    throw new Error(
      "At least one provider must be configured in createConfig. You can also use defaultProviders({ appId: 'my-app-id' }) to get a standard set of providers.",
    );
  }
  const aggregators = params.providers;

  validateOptions(params.options || {});

  return {
    options: params.options || {},
    clientLookup: createClientLookupFunction(params.clients),
    aggregators: aggregators,
  };
}

function createProxyConfig(params: ProxyConfigParams): Config {
  return {
    options: {},
    clientLookup: createClientLookupFunction(params.clients),
    aggregators: [],
    proxy: params.proxy,
  };
}

// Normalize the contract for fetching a client
function createClientLookupFunction(
  clients?: PublicClient | PublicClient[] | ((chainId: number) => PublicClient | undefined),
): (chainId: number) => PublicClient | undefined {
  let clientLookup: (chainId: number) => PublicClient | undefined = () => undefined;
  if (clients !== undefined) {
    if (typeof clients === "function") {
      clientLookup = clients;
    } else if (Array.isArray(clients)) {
      clientLookup = (chainId: number) =>
        (clients as PublicClient[]).find((c) => c.chain?.id === chainId);
    }
  }
  return clientLookup;
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
