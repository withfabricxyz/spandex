import { type Address, type Hex, zeroAddress } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ExactInSwapParams,
  type PoolEdge,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type QuoteMetrics,
  type QuotePricing,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapParams,
  type TokenNode,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { computeUsdPriceFromValue } from "../util/pricing.js";
import { Aggregator } from "./index.js";

const LCX_DOCS_URL = "https://dex.lcx.com/docs";
const DEFAULT_BASE_URL = "https://swap-api.lcx.com/v1";

const ROUTER: Address = "0x0000000000b1ae06c96aB73FF4360d7AeAaB56F0";
const ROUTER_2: Address = "0x0000000000654902B6Ed6cC240cc81CB4c4a3dff";

/**
 * Published LCX Liberty DEX router for each supported chain. A quote must name this router as
 * its spender and the built transaction must target it, otherwise the quote is rejected.
 */
const LCX_ROUTERS: Record<number, Address> = {
  1: ROUTER, // Ethereum
  10: ROUTER, // OP Mainnet
  8453: ROUTER, // Base
  42161: ROUTER, // Arbitrum One
  25: ROUTER_2, // Cronos
  56: ROUTER_2, // BNB Chain
  100: ROUTER_2, // Gnosis
  130: ROUTER_2, // Unichain
  137: ROUTER_2, // Polygon
  143: ROUTER_2, // Monad
  146: ROUTER_2, // Sonic
  324: ROUTER_2, // ZKsync Era
  480: ROUTER_2, // World Chain
  999: ROUTER_2, // HyperEVM
  1868: ROUTER_2, // Soneium
  4326: ROUTER_2, // MegaETH
  4663: ROUTER_2, // Robinhood Chain
  5042: ROUTER_2, // Arc
  9745: ROUTER_2, // Plasma
  43114: ROUTER_2, // Avalanche
  57073: ROUTER_2, // Ink
  59144: ROUTER_2, // Linea
};

/**
 * Configuration options for the LCX Liberty DEX aggregator.
 */
export type LcxConfig = ProviderConfig & {
  /**
   * API key sent as a bearer token in the `Authorization` header.
   * Create a free key at https://dex.lcx.com/dashboard.
   */
  apiKey: string;
  /**
   * Base URL for the API. Defaults to `https://swap-api.lcx.com/v1`.
   */
  baseUrl?: string;
};

/**
 * Aggregator implementation for the LCX Liberty DEX swap API (same-chain, exact input).
 *
 * Each quote is two requests: `POST /quote` prices the trade and `POST /build` turns the
 * returned `quoteId` into router calldata for the recipient. Both responses are checked
 * against the request and the published router before the quote is returned.
 *
 * @see https://dex.lcx.com/docs
 */
export class LcxAggregator extends Aggregator<LcxConfig> {
  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "LCX Liberty DEX",
      url: "https://dex.lcx.com",
      docsUrl: LCX_DOCS_URL,
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "lcx";
  }

  /**
   * LCX Liberty DEX uses the zero address for the native coin.
   */
  override nativeTokenAddress(): Address {
    return zeroAddress;
  }

  /**
   * @inheritdoc
   */
  override features(): AggregatorFeature[] {
    return ["exactIn"];
  }

  /**
   * @inheritdoc
   */
  protected override async tryFetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    if (request.mode === "targetOut") {
      throw new QuoteError("LCX Liberty DEX does not support exact output quotes");
    }

    if ((request.outputChainId ?? request.chainId) !== request.chainId) {
      throw new QuoteError("LCX Liberty DEX does not support cross-chain quotes");
    }

    const router = LCX_ROUTERS[request.chainId];
    if (!router) {
      throw new QuoteError(`LCX Liberty DEX does not support chain ${request.chainId}`);
    }

    const exactIn = request as ExactInSwapParams;
    const { quote } = await this.post<LcxQuoteData>("/quote", {
      chainId: exactIn.chainId,
      tokenIn: exactIn.inputToken,
      tokenOut: exactIn.outputToken,
      amountIn: exactIn.inputAmount.toString(),
      slippageBps: exactIn.slippageBps,
    });
    if (!quote?.quoteId) {
      throw new QuoteError("LCX Liberty DEX returned no quote", quote);
    }
    validateQuote(exactIn, quote, router);

    const build = await this.post<LcxBuild>("/build", {
      quoteId: quote.quoteId,
      recipient: exactIn.recipientAccount ?? exactIn.swapperAccount,
      slippageBps: exactIn.slippageBps,
    });
    validateBuild(exactIn, quote, build, router);

    const details: LcxQuoteResponse = { quote, build };
    const outputAmount = BigInt(quote.output.amount);
    const txValue = BigInt(build.swap.value);

    return {
      success: true,
      provider: "lcx",
      details,
      latency: 0,
      inputChainId: exactIn.chainId,
      outputChainId: exactIn.chainId,
      execution: "atomic",
      inputAmount: exactIn.inputAmount,
      outputAmount,
      networkFee: parseBigInt(quote.gasEstimateWei) ?? 0n,
      txData: {
        to: build.swap.to,
        data: build.swap.data,
        ...(txValue > 0n ? { value: txValue } : {}),
      },
      approval: !isNativeToken(exactIn.inputToken)
        ? {
            token: exactIn.inputToken,
            spender: router,
          }
        : undefined,
      route: lcxRouteGraph(quote, exactIn),
      pricing: buildLcxPricing(exactIn, quote, outputAmount),
      metrics: buildLcxMetrics(quote),
    };
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.config.apiKey) {
      throw new Error(
        "LCX Liberty DEX API key is not set. Please set the LCX_API_KEY environment variable.",
      );
    }

    const response = await fetch(`${this.baseUrl()}${path}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const envelope = (await response.json().catch(() => undefined)) as LcxEnvelope<T> | undefined;
    if (!response.ok || envelope?.success !== true || !envelope.data) {
      const code = envelope?.code ?? envelope?.error;
      const status = code ? `${response.status} (${code})` : `${response.status}`;
      throw new QuoteError(
        `LCX Liberty DEX ${path} request failed with status ${status}`,
        envelope,
      );
    }

    return envelope.data;
  }

  private baseUrl() {
    return (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }
}

/**
 * Convenience factory for creating an LCX Liberty DEX aggregator instance.
 *
 * @param config - LCX Liberty DEX configuration.
 * @returns LcxAggregator instance.
 */
export function lcx(config: LcxConfig): LcxAggregator {
  return new LcxAggregator(config);
}

/**
 * Rejects a quote that does not describe the requested trade or names an unexpected spender.
 */
function validateQuote(request: ExactInSwapParams, quote: LcxQuote, router: Address) {
  if (!sameAddress(quote.spender, router)) {
    throw new QuoteError("LCX Liberty DEX quote spender is not the published router", quote);
  }
  if (parseBigInt(quote.input?.amount) !== request.inputAmount) {
    throw new QuoteError("LCX Liberty DEX quote input amount does not match the request", quote);
  }
  if (
    !sameAddress(quote.input?.token, request.inputToken) ||
    !sameAddress(quote.output?.token, request.outputToken)
  ) {
    throw new QuoteError("LCX Liberty DEX quote tokens do not match the request", quote);
  }
  if (parseBigInt(quote.output?.amount) === undefined) {
    throw new QuoteError("LCX Liberty DEX quote has no output amount", quote);
  }
}

/**
 * Rejects built calldata that targets another contract or chain, or whose floor or value
 * differs from the quote.
 */
function validateBuild(
  request: ExactInSwapParams,
  quote: LcxQuote,
  build: LcxBuild,
  router: Address,
) {
  const swap = build.swap;
  if (!swap || !sameAddress(swap.to, router)) {
    throw new QuoteError("LCX Liberty DEX build does not target the published router", build);
  }
  if (Number(swap.chainId) !== request.chainId) {
    throw new QuoteError("LCX Liberty DEX build is for a different chain", build);
  }
  if (build.routerDeployed !== true) {
    throw new QuoteError(
      `LCX Liberty DEX router is not deployed on chain ${request.chainId}`,
      build,
    );
  }
  const minAmountOut = parseBigInt(build.minAmountOut);
  if (minAmountOut === undefined || minAmountOut !== parseBigInt(quote.output.minimumAmount)) {
    throw new QuoteError("LCX Liberty DEX build minimum output does not match the quote", build);
  }
  const expectedValue = isNativeToken(request.inputToken) ? request.inputAmount : 0n;
  if (parseBigInt(swap.value) !== expectedValue) {
    throw new QuoteError("LCX Liberty DEX build value does not match the input amount", build);
  }
  if (typeof swap.data !== "string" || !swap.data.startsWith("0x")) {
    throw new QuoteError("LCX Liberty DEX build has no calldata", build);
  }
}

/**
 * Builds a route DAG from the quote's split paths and their hops.
 */
export function lcxRouteGraph(quote: LcxQuote, request: ExactInSwapParams): RouteGraph {
  const nodeMap = new Map<string, TokenNode>();
  const setNode = (address: Address) => {
    nodeMap.set(address.toLowerCase(), { address });
  };
  setNode(request.inputToken);
  setNode(request.outputToken);

  const edges: PoolEdge[] = [];
  for (const [pathIndex, path] of (quote.routes ?? []).entries()) {
    for (const [hopIndex, hop] of (path.hops ?? []).entries()) {
      if (!isAddressLike(hop.tokenIn) || !isAddressLike(hop.tokenOut)) {
        continue;
      }
      setNode(hop.tokenIn);
      setNode(hop.tokenOut);
      edges.push({
        source: hop.tokenIn,
        target: hop.tokenOut,
        address: isAddressLike(hop.pool) ? hop.pool : undefined,
        key: `${hop.pool ?? hop.poolId ?? hop.dex ?? "hop"}-${pathIndex}-${hopIndex}`,
        value: Number(path.amountIn ?? 0),
      });
    }
  }

  return { nodes: [...nodeMap.values()], edges };
}

function buildLcxPricing(
  request: ExactInSwapParams,
  quote: LcxQuote,
  outputAmount: bigint,
): QuotePricing {
  const inputDecimals = quote.input.decimals ?? undefined;
  const outputDecimals = quote.output.decimals ?? undefined;
  return {
    inputToken: {
      address: request.inputToken,
      decimals: inputDecimals,
      usdPrice: computeUsdPriceFromValue(
        request.inputAmount,
        inputDecimals,
        quote.usdValueIn ?? undefined,
      ),
    },
    outputToken: {
      address: request.outputToken,
      decimals: outputDecimals,
      usdPrice: computeUsdPriceFromValue(
        outputAmount,
        outputDecimals,
        quote.usdValueOut ?? undefined,
      ),
    },
  };
}

function buildLcxMetrics(quote: LcxQuote): QuoteMetrics | undefined {
  const impact = quote.priceImpactPct;
  if (impact === undefined || impact === null || !Number.isFinite(impact)) {
    return undefined;
  }
  return { priceImpactBps: Math.round(impact * 100) };
}

function sameAddress(a: unknown, b: Address): boolean {
  return typeof a === "string" && a.toLowerCase() === b.toLowerCase();
}

function isAddressLike(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseBigInt(value?: string | number | null): bigint | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

type LcxEnvelope<T> = {
  success: boolean;
  data?: T;
  code?: string;
  error?: string;
  message?: string;
};

type LcxQuoteData = {
  quote: LcxQuote;
};

export type LcxQuoteAmount = {
  token: Address;
  amount: string;
  decimals?: number | null;
};

export type LcxRouteHop = {
  dex?: string;
  family?: string;
  pool?: string | null;
  poolId?: string | null;
  tokenIn?: Address;
  tokenOut?: Address;
  /** True when the hop is a market maker leg that fills only while its quote is fresh. */
  conditional?: boolean;
  [key: string]: unknown;
};

export type LcxRoutePath = {
  amountIn?: string;
  amountOut?: string;
  hops?: LcxRouteHop[];
};

export type LcxQuote = {
  quoteId: string;
  chainId: number;
  input: LcxQuoteAmount;
  output: LcxQuoteAmount & {
    /** Floor enforced onchain at the requested slippage. */
    minimumAmount: string;
  };
  priceImpactPct?: number | null;
  usdValueIn?: number | null;
  usdValueOut?: number | null;
  /** Estimated network fee in wei, or null while the gas price is unknown. */
  gasEstimateWei?: string | null;
  spender: Address;
  routes?: LcxRoutePath[];
  venues?: string[];
  /** Unix seconds after which the quote can no longer be built. */
  expiresAt?: number;
  [key: string]: unknown;
};

export type LcxBuild = {
  swap: {
    chainId: number;
    to: Address;
    data: Hex;
    /** Decimal string in wei. */
    value: string;
  };
  minAmountOut: string;
  deadline?: string | number;
  routerDeployed: boolean;
  /** Server-side `eth_call` of the calldata; `skipped` before an ERC-20 approval exists. */
  simulation?: { status: string; why?: string; [key: string]: unknown };
  [key: string]: unknown;
};

/**
 * Raw LCX Liberty DEX responses kept on the quote: the priced quote and the built transaction.
 */
export type LcxQuoteResponse = {
  quote: LcxQuote;
  build: LcxBuild;
};
