import {
  type Address,
  type DecodeFunctionDataReturnType,
  decodeFunctionData,
  type Hex,
  zeroAddress,
} from "viem";
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
 * The only contracts a `makerSwap` maker leg may call or approve: Bebop's RFQ router and its
 * settlement contract.
 */
const BEBOP_CONTRACTS = new Set([
  "0xbeb0009aca35087ce7ccf11637e24dd1aad3bf2a",
  "0xbbbbbbb520d69a9775e85b458c58c648259fad5f",
]);

const LEGS = {
  name: "legs",
  type: "tuple[]",
  components: [
    { name: "amountIn", type: "uint256" },
    {
      name: "hops",
      type: "tuple[]",
      components: [
        { name: "family", type: "uint8" },
        { name: "pool", type: "address" },
        { name: "tokenIn", type: "address" },
        { name: "tokenOut", type: "address" },
        { name: "aux", type: "uint256" },
      ],
    },
  ],
} as const;

const FEE_SWAP_ARGS = {
  name: "a",
  type: "tuple",
  components: [
    { name: "tokenIn", type: "address" },
    { name: "tokenOut", type: "address" },
    { name: "totalIn", type: "uint256" },
    { name: "minAmountOut", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "deadline", type: "uint256" },
    { name: "integrator", type: "address" },
  ],
} as const;

const AMOUNT_OUT = [{ name: "amountOut", type: "uint256" }] as const;

/**
 * Router entrypoints `/v1/build` can return. Calldata for any other function is rejected.
 * Selectors: swapSplit 0xfc54261d, swapSplitWithFee 0x5e98574a, swapSplitViaPropAMM 0x195e648e,
 * swapSplitWithPropAMMSplit 0x31ab353b, makerSwap 0xa565fdcc.
 */
export const LCX_ROUTER_ABI = [
  {
    name: "swapSplit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "totalIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
      LEGS,
    ],
    outputs: AMOUNT_OUT,
  },
  {
    name: "swapSplitWithFee",
    type: "function",
    stateMutability: "payable",
    inputs: [FEE_SWAP_ARGS, LEGS],
    outputs: AMOUNT_OUT,
  },
  {
    name: "swapSplitViaPropAMM",
    type: "function",
    stateMutability: "payable",
    inputs: [
      FEE_SWAP_ARGS,
      LEGS,
      { name: "venue", type: "address" },
      { name: "coreNetOut", type: "uint256" },
    ],
    outputs: AMOUNT_OUT,
  },
  {
    name: "swapSplitWithPropAMMSplit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      FEE_SWAP_ARGS,
      { ...LEGS, name: "splitLegs" },
      { ...LEGS, name: "fullLegs" },
      {
        name: "s",
        type: "tuple",
        components: [
          { name: "venue", type: "address" },
          { name: "venueIn", type: "uint256" },
          { name: "venueMinOut", type: "uint256" },
        ],
      },
    ],
    outputs: AMOUNT_OUT,
  },
  {
    name: "makerSwap",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "a",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { ...LEGS, name: "poolLegs" },
      {
        name: "m",
        type: "tuple",
        components: [
          { name: "target", type: "address" },
          { name: "spender", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minOut", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
      { ...LEGS, name: "fallbackLegs" },
    ],
    outputs: AMOUNT_OUT,
  },
] as const;

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
 * Rejects a build that targets another contract or chain, or whose floor differs from the quote,
 * then checks the calldata itself.
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
  verifyCalldata(request, quote, swap);
}

/**
 * Decodes the router call that will be signed and rejects it unless it sells exactly the
 * requested amount of the requested token, pays the intended recipient, keeps at least the
 * quoted floor, attaches the right value and has not expired. Wrapper calls may not name an
 * integrator, and a maker leg must call Bebop's contracts or be empty. These are the checks
 * the LCX Liberty DEX app applies before signing.
 */
function verifyCalldata(request: ExactInSwapParams, quote: LcxQuote, swap: LcxBuild["swap"]) {
  const call = decodeRouterCall(swap.data);
  if (!call) {
    throw new QuoteError("LCX Liberty DEX calldata is not a known router call", swap);
  }
  if (!sameAddress(call.recipient, request.recipientAccount ?? request.swapperAccount)) {
    throw new QuoteError("LCX Liberty DEX calldata pays a different recipient", swap);
  }
  if (call.totalIn !== request.inputAmount) {
    throw new QuoteError("LCX Liberty DEX calldata input amount does not match the request", swap);
  }
  if (
    !sameAddress(call.tokenIn, request.inputToken) ||
    !sameAddress(call.tokenOut, request.outputToken)
  ) {
    throw new QuoteError("LCX Liberty DEX calldata tokens do not match the request", swap);
  }
  const floor = parseBigInt(quote.output.minimumAmount);
  if (floor === undefined || call.minAmountOut < floor) {
    throw new QuoteError("LCX Liberty DEX calldata minimum output is below the quote", swap);
  }
  const expectedValue = isNativeToken(request.inputToken) ? call.totalIn : 0n;
  if (parseBigInt(swap.value) !== expectedValue) {
    throw new QuoteError("LCX Liberty DEX build value does not match the input amount", swap);
  }
  if (call.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new QuoteError("LCX Liberty DEX calldata deadline has passed", swap);
  }
  // No integrator is requested, so none may take a fee.
  if (call.integrator !== undefined && !sameAddress(call.integrator, zeroAddress)) {
    throw new QuoteError("LCX Liberty DEX calldata names an integrator", swap);
  }
  // The prop-AMM venue needs no allowlist: the router reverts unless the recipient receives
  // minAmountOut, which is checked against the quote's floor above.
  if (call.venueIn !== undefined && call.venueIn > call.totalIn) {
    throw new QuoteError("LCX Liberty DEX calldata prop-AMM leg exceeds the input amount", swap);
  }
  const maker = call.maker;
  if (maker) {
    const bebop =
      BEBOP_CONTRACTS.has(maker.target.toLowerCase()) &&
      BEBOP_CONTRACTS.has(maker.spender.toLowerCase());
    const empty =
      maker.amountIn === 0n &&
      sameAddress(maker.target, zeroAddress) &&
      sameAddress(maker.spender, zeroAddress) &&
      maker.data === "0x";
    if (!bebop && !empty) {
      throw new QuoteError("LCX Liberty DEX calldata maker leg names a non-Bebop contract", swap);
    }
    if (maker.amountIn > call.totalIn) {
      throw new QuoteError("LCX Liberty DEX calldata maker leg exceeds the input amount", swap);
    }
  }
}

type RouterCall = {
  tokenIn: Address;
  tokenOut: Address;
  totalIn: bigint;
  minAmountOut: bigint;
  recipient: Address;
  deadline: bigint;
  /** Set by the three wrapper entrypoints. */
  integrator?: Address;
  /** Set by `swapSplitWithPropAMMSplit`. */
  venueIn?: bigint;
  /** Set by `makerSwap`. */
  maker?: { target: Address; spender: Address; amountIn: bigint; data: Hex };
};

/**
 * Reads the swap fields from any router entrypoint, wherever they sit in its arguments.
 * Returns undefined for calldata that does not decode against the router ABI.
 */
function decodeRouterCall(data: Hex): RouterCall | undefined {
  let decoded: DecodeFunctionDataReturnType<typeof LCX_ROUTER_ABI>;
  try {
    decoded = decodeFunctionData({ abi: LCX_ROUTER_ABI, data });
  } catch {
    return undefined;
  }
  switch (decoded.functionName) {
    case "swapSplit": {
      const [tokenIn, tokenOut, totalIn, minAmountOut, recipient, deadline] = decoded.args;
      return { tokenIn, tokenOut, totalIn, minAmountOut, recipient, deadline };
    }
    case "makerSwap": {
      const [a, , maker] = decoded.args;
      return { ...a, totalIn: a.amountIn, maker };
    }
    case "swapSplitWithPropAMMSplit": {
      const [a, , , s] = decoded.args;
      return { ...a, venueIn: s.venueIn };
    }
    case "swapSplitWithFee":
    case "swapSplitViaPropAMM":
      return { ...decoded.args[0] };
    default:
      return undefined;
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
