import type { Address, Hex } from "viem";
import { amountToNumber } from "../pricing.js";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type Fee,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type QuoteMetrics,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenPricing,
} from "../types.js";
import { Aggregator } from "./index.js";

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
 */
export type FabricConfig = ProviderConfig & {
  /** Base URL for the Fabric API. */
  url?: string;
  /** API key for accessing the Fabric API. */
  apiKey?: string;
};

/**
 * Aggregator implementation that queries the Fabric routing API.
 */
export class FabricAggregator extends Aggregator<FabricConfig> {
  /**
   * @param config - Fabric-specific configuration such as base URL or API key.
   */
  constructor(config: FabricConfig = {}) {
    super(config);
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
    const inputAmount = BigInt(response.amountIn);
    const outputAmount = BigInt(response.amountOut);
    const tokenLookup = buildTokenLookup(response.tokens);
    const inputToken = buildTokenPricing(request.inputToken, tokenLookup);
    const outputToken = buildTokenPricing(request.outputToken, tokenLookup);

    const fees = buildFees(response.fees);
    const metrics = buildFabricMetrics(
      response,
      inputAmount,
      outputAmount,
      inputToken,
      outputToken,
    );

    return {
      success: true,
      provider: "fabric",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      inputAmount,
      outputAmount,
      networkFee: 0n, // TODO
      txData: {
        to: response.transaction.to,
        data: response.transaction.data,
        value: BigInt(response.transaction.value),
      },
      approval: response.approval,
      route: fabricRouteGraph(response),
      pricing: {
        inputToken,
        outputToken,
      },
      fees,
      metrics,
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

function buildTokenLookup(tokens: TokenData[]): Map<string, TokenData> {
  const map = new Map<string, TokenData>();
  for (const token of tokens) {
    map.set(token.address.toLowerCase(), token);
  }
  return map;
}

function buildTokenPricing(address: Address, lookup: Map<string, TokenData>): TokenPricing {
  const token = lookup.get(address.toLowerCase());
  return {
    address,
    symbol: token?.symbol,
    decimals: token?.decimals,
    usdPrice: token?.priceUsd,
  };
}

function buildFees(fees: FabricFee[]): Fee[] | undefined {
  if (fees.length === 0) {
    return undefined;
  }

  return fees.map((fee) => ({
    type: "other",
    token: fee.token,
    amount: BigInt(fee.amount),
  }));
}

function buildFabricMetrics(
  response: FabricQuoteResponse,
  inputAmount: bigint,
  outputAmount: bigint,
  inputToken: TokenPricing,
  outputToken: TokenPricing,
): QuoteMetrics | undefined {
  const spotPrice = response.price;
  if (!Number.isFinite(spotPrice) || spotPrice === 0) {
    return undefined;
  }

  const inputNormalized = amountToNumber(inputAmount, inputToken.decimals);
  const outputNormalized = amountToNumber(outputAmount, outputToken.decimals);

  if (inputNormalized === null || outputNormalized === null) {
    return undefined;
  }

  const executionPrice = outputNormalized / inputNormalized;
  if (!Number.isFinite(executionPrice)) {
    return undefined;
  }

  const impact = Math.abs(spotPrice - executionPrice) / spotPrice;
  return {
    priceImpactBps: Math.round(impact * 10_000),
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
