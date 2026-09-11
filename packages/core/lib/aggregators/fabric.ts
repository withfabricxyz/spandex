import { type Address, type Hex, zeroAddress } from "viem";
import {
  type AggregationOptions,
  type AggregatorFeature,
  type AggregatorMetadata,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
} from "../types.js";
import { Aggregator } from "./index.js";

const FABRIC_DEPRECATION_MESSAGE =
  "The Fabric provider is deprecated and shuts down on September 16, 2026. Remove fabric() from your spanDEX provider configuration and use nordstern() or another active provider.";

export type FabricQuoteResponse = {
  blockNumber: number;
  amountIn: string;
  amountOut: string;
  price: number;
  description: string;
  tokens: TokenData[];
  route: Route;
  approval?: {
    token: Address;
    amount: string;
    spender: Address;
  };
  transaction: {
    to: Address;
    data: `0x${string}`;
    value: string;
  };
  fees: FabricFee[];
  id: string;
};

type FabricFee = {
  recipient: Address;
  token: Address;
  amount: string;
};

type TokenData = {
  symbol: string;
  decimals: number;
  address: Address;
  priceUsd?: number;
};

type Swap = {
  key: Hex;
  address: Address;
  protocol: string;
  fork: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
};

type Route = {
  swaps: Swap[][];
  amountIn: string;
  amountOut: string;
};

/**
 * Configuration options for the Fabric aggregator.
 *
 * @deprecated Fabric shuts down on September 16, 2026. Use Nordstern or another active provider.
 */
export type FabricConfig = ProviderConfig & {
  /** App ID for accessing the Fabric API. */
  appId: string;
  /** Base URL for the Fabric API. */
  url?: string;
  /** API key for accessing the Fabric API. */
  apiKey?: string;
};

/**
 * Compatibility stub for the deprecated Fabric routing API.
 *
 * @deprecated Fabric shuts down on September 16, 2026. Quote requests always reject.
 */
export class FabricAggregator extends Aggregator<FabricConfig> {
  constructor(config: FabricConfig) {
    super(config);
    console.warn(`[spanDEX] ${FABRIC_DEPRECATION_MESSAGE}`);
  }

  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "Fabric",
      url: "https://spandex.sh",
      docsUrl: "https://spandex.sh",
      logoUrl: "https://spandex.sh/images/fabric.svg",
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "fabric";
  }

  override nativeTokenAddress(): Address {
    return zeroAddress;
  }

  /**
   * @inheritdoc
   */
  override features(): AggregatorFeature[] {
    return ["exactIn", "targetOut", "integratorFees", "integratorSurplus"];
  }

  /** Rejects immediately without resolving options, retrying, or making a network request. */
  override async fetchQuote(_params: SwapParams, _options?: AggregationOptions): Promise<never> {
    throw new QuoteError(FABRIC_DEPRECATION_MESSAGE);
  }

  protected override async tryFetchQuote(
    _request: SwapParams,
    _options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    throw new QuoteError(FABRIC_DEPRECATION_MESSAGE);
  }
}

/**
 * Convenience factory for creating a Fabric aggregator instance.
 *
 * @param config - Fabric configuration (app id, base URL, API key).
 * @returns FabricAggregator instance.
 *
 * @deprecated Fabric shuts down on September 16, 2026. Use Nordstern or another active provider.
 */
export function fabric(config: FabricConfig): FabricAggregator {
  return new FabricAggregator(config);
}

export function fabricRouteGraph(quote: FabricQuoteResponse): RouteGraph {
  const swaps = quote.route.swaps.flat();
  const nodes = quote.tokens;
  const edges = swaps.map((swap) => ({
    source: swap.tokenIn,
    target: swap.tokenOut,
    address: swap.address,
    key: swap.key,
    value: Number(swap.amountIn),
  }));

  return {
    nodes,
    edges,
  };
}
