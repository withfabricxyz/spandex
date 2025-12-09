import type { Address, Hex } from "viem";
import { Aggregator } from "../aggregator.js";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
} from "../types.js";

const DEFAULT_URL = "https://booda.defi.withfabric.xyz";

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
  fees: Fee[];
  id: string;
};

type Fee = {
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
 */
export type FabricConfig = {
  /** Base URL for the Fabric API. */
  url?: string;
  /** API key for accessing the Fabric API. */
  apiKey?: string;
};

/**
 * Aggregator implementation that queries the Fabric routing API.
 */
export class FabricAggregator extends Aggregator {
  /**
   * @param config - Fabric-specific configuration such as base URL or API key.
   */
  constructor(private config: FabricConfig = {}) {
    super();
  }

  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "Fabric",
      url: "https://withfabric.xyz",
      docsUrl: "https://docs.withfabric.xyz",
      logoUrl: "https://withfabric.xyz/images/fabric.svg",
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "fabric";
  }

  /**
   * @inheritdoc
   */
  override features(): AggregatorFeature[] {
    return ["exactIn", "targetOut", "integratorFees", "integratorSurplus"];
  }

  /**
   * @inheritdoc
   */
  protected override async tryFetchQuote(
    request: SwapParams,
    options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    const response = await this.makeRequest(request, options);

    return {
      success: true,
      provider: "fabric",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      inputAmount: BigInt(response.amountIn),
      outputAmount: BigInt(response.amountOut),
      networkFee: 0n, // TODO
      txData: {
        to: response.transaction.to,
        data: response.transaction.data,
        value: BigInt(response.transaction.value),
      },
      route: fabricRouteGraph(response),
    };
  }

  private async makeRequest(
    params: SwapParams,
    options: SwapOptions,
  ): Promise<FabricQuoteResponse> {
    const query = new URLSearchParams(extractQueryParams(params, options));

    return await fetch(`${this.config.url || DEFAULT_URL}/v1/quote?${query.toString()}`, {
      headers: {
        accept: "application/json",
      },
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) {
        throw new QuoteError(`Fabric API request failed with status ${response.status}`, body);
      }
      return body as FabricQuoteResponse;
    });
  }
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

function extractQueryParams(params: SwapParams, options: SwapOptions): Record<string, string> {
  const result: Record<string, string> = {
    chainId: params.chainId.toString(),
    buyToken: params.outputToken,
    sellToken: params.inputToken,
    slippageBps: params.slippageBps.toString(),
    receiver: params.swapperAccount,
  };

  if (params.mode === "exactIn") {
    result.sellAmount = params.inputAmount.toString();
  } else {
    result.buyAmount = params.outputAmount.toString();
  }

  if (options.integratorFeeAddress) {
    result.feeRecipient = options.integratorFeeAddress;
  }

  if (options.integratorSwapFeeBps !== undefined) {
    result.feeBps = options.integratorSwapFeeBps.toString();
  }

  if (options.integratorSurplusBps !== undefined) {
    result.surplusBps = options.integratorSurplusBps.toString();
  }

  return result;
}
