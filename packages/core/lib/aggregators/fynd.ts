import { type Address, type Hex, zeroAddress } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ExactInSwapParams,
  type Fee,
  type PoolEdge,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type QuoteMetrics,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenNode,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { Aggregator } from "./index.js";

const FYND_DOCS_URL = "https://docs.fynd.xyz/get-started/hosted-api";
const HOSTED_BASE_URL = "https://fynd-api.propellerheads.xyz";

/**
 * Chain path segments used by the hosted Fynd API (`/v1/{chain}/quote`).
 * Extend or override with `chains` in the hosted config.
 */
const HOSTED_CHAIN_PATHS: Record<number, string> = {
  1: "ethereum",
  56: "bsc",
  130: "unichain",
  137: "polygon",
  4663: "robinhood",
  8453: "base",
  42161: "arbitrum",
};

type FyndBaseConfig = ProviderConfig & {
  /**
   * Solver timeout forwarded as `options.timeout_ms`. Defaults to the server default.
   */
  timeoutMsSolver?: number;
  /**
   * Forwarded as `options.min_responses`. Defaults to the server default.
   */
  minResponses?: number;
  /**
   * Forwarded as `options.max_gas`; routes exceeding this gas limit are rejected.
   */
  maxGas?: bigint | string;
};

/**
 * Configuration for the hosted Fynd API. Requires an API key and routes
 * requests to `/v1/{chain}/quote`, where `{chain}` is looked up by chain ID.
 */
export type FyndHostedConfig = FyndBaseConfig & {
  /**
   * API key sent in the `Authorization` header (raw key, no `Bearer` prefix).
   * Obtain one from the `@fynd_portal_bot` on Telegram.
   */
  apiKey: string;
  /**
   * Base URL. Defaults to `https://fynd-api.propellerheads.xyz`.
   */
  baseUrl?: string;
  /**
   * Chain ID to hosted path segment overrides, merged over the built-in map.
   */
  chains?: Record<number, string>;
  chainId?: never;
};

/**
 * Configuration for a self-hosted Fynd instance (`fynd serve`). A self-hosted
 * server serves exactly one chain at `/v1/quote` without authentication.
 */
export type FyndSelfHostedConfig = FyndBaseConfig & {
  /**
   * Base URL of your Fynd server, e.g. `http://localhost:8080`.
   */
  baseUrl: string;
  /**
   * The single chain ID this server is configured for.
   */
  chainId: number;
  /**
   * Optional API key if your deployment sits behind an auth proxy.
   */
  apiKey?: string;
  chains?: never;
};

/**
 * Configuration options for the Fynd aggregator.
 */
export type FyndConfig = FyndHostedConfig | FyndSelfHostedConfig;

/**
 * Aggregator implementation for Fynd, PropellerHeads' open-source solver.
 *
 * Fynd exposes `POST /v1/{chain}/quote` (hosted) or `POST /v1/quote`
 * (self-hosted). Passing `encoding_options` returns the quote together with
 * router calldata, so a single request yields an executable transaction.
 *
 * @see https://docs.fynd.xyz/get-started/hosted-api
 */
export class FyndAggregator extends Aggregator<FyndConfig> {
  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "fynd",
      url: "https://fynd.xyz",
      docsUrl: FYND_DOCS_URL,
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "fynd";
  }

  /**
   * Fynd uses the zero address for the native token; the router wraps it.
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
  protected override async tryFetchQuote(
    request: SwapParams,
    options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    if (request.mode === "targetOut") {
      throw new QuoteError("fynd aggregator does not support exact output quotes");
    }

    if ((request.outputChainId ?? request.chainId) !== request.chainId) {
      throw new QuoteError("fynd aggregator does not support cross-chain quotes");
    }

    const response = await this.quote(request as ExactInSwapParams, options);
    const order = response.orders?.[0];
    if (!order) {
      throw new QuoteError("fynd API returned no orders", response);
    }
    if (order.status !== "success") {
      throw new QuoteError(`fynd solver returned status ${order.status}`, response);
    }
    const tx = order.transaction;
    if (!tx) {
      throw new QuoteError("fynd quote did not include an encoded transaction", response);
    }

    const inputAmount = parseBigInt(order.amount_in) ?? request.inputAmount;
    const outputAmount = parseBigInt(order.amount_out) ?? 0n;
    const gas = parseBigInt(order.gas_estimate);
    const gasPrice = parseBigInt(order.gas_price);
    const networkFee = gas !== undefined && gasPrice !== undefined ? gas * gasPrice : 0n;
    const txValue = parseBigInt(tx.value) ?? 0n;

    return {
      success: true,
      provider: "fynd",
      details: response,
      latency: 0,
      inputChainId: request.chainId,
      outputChainId: request.chainId,
      execution: "atomic",
      inputAmount,
      outputAmount,
      networkFee,
      // Fynd's gas_estimate is too tight to use as a gas limit: routes revert
      // with Dispatcher__SwapReverted when it is applied verbatim. Leave `gas`
      // unset so simulation and execution estimate it; the estimate still
      // informs `networkFee`.
      txData: {
        to: tx.to,
        data: tx.data,
        ...(txValue > 0n ? { value: txValue } : {}),
      },
      approval: !isNativeToken(request.inputToken)
        ? {
            token: request.inputToken,
            spender: tx.to,
          }
        : undefined,
      route: fyndRouteGraph(order, request as ExactInSwapParams),
      fees: buildFyndFees(order, request as ExactInSwapParams),
      metrics: buildFyndMetrics(order),
      pricing: {
        inputToken: { address: request.inputToken },
        outputToken: { address: request.outputToken },
      },
    };
  }

  private async quote(
    request: ExactInSwapParams,
    options: SwapOptions,
  ): Promise<FyndQuoteResponse> {
    const url = this.quoteUrl(request.chainId);
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
    };
    if (this.config.apiKey) {
      headers.authorization = this.config.apiKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequestBody(request, options, this.config)),
    });

    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message =
        typeof body === "object" && body && "error" in body
          ? String((body as FyndErrorResponse).error)
          : `status ${response.status}`;
      throw new QuoteError(`fynd API request failed: ${message}`, body);
    }

    return body as FyndQuoteResponse;
  }

  private quoteUrl(chainId: number): string {
    if (isSelfHosted(this.config)) {
      if (this.config.chainId !== chainId) {
        throw new QuoteError(
          `fynd self-hosted server is configured for chain ${this.config.chainId}, not ${chainId}`,
        );
      }
      return `${trimSlash(this.config.baseUrl)}/v1/quote`;
    }

    if (!this.config.apiKey) {
      throw new Error("fynd API key is not set. Please set the FYND_API_KEY environment variable.");
    }
    const chainPath = { ...HOSTED_CHAIN_PATHS, ...this.config.chains }[chainId];
    if (!chainPath) {
      throw new QuoteError(`fynd hosted API has no chain path for chain ${chainId}`);
    }
    return `${trimSlash(this.config.baseUrl ?? HOSTED_BASE_URL)}/v1/${chainPath}/quote`;
  }
}

/**
 * Convenience factory for creating a Fynd aggregator instance.
 *
 * @param config - Hosted (`apiKey`) or self-hosted (`baseUrl` + `chainId`) configuration.
 * @returns FyndAggregator instance.
 */
export function fynd(config: FyndConfig): FyndAggregator {
  return new FyndAggregator(config);
}

function isSelfHosted(config: FyndConfig): config is FyndSelfHostedConfig {
  return typeof config.chainId === "number";
}

function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function buildRequestBody(
  params: ExactInSwapParams,
  options: SwapOptions,
  config: FyndConfig,
): FyndQuoteRequest {
  const order: FyndOrder = {
    token_in: params.inputToken,
    token_out: params.outputToken,
    amount: params.inputAmount.toString(),
    side: "sell",
    sender: params.swapperAccount,
  };
  const recipient = params.recipientAccount ?? params.swapperAccount;
  if (recipient.toLowerCase() !== params.swapperAccount.toLowerCase()) {
    order.receiver = recipient;
  }

  const requestOptions: FyndQuoteOptions = {
    encoding_options: {
      slippage: (params.slippageBps / 10_000).toString(),
    },
  };
  const timeoutMs = config.timeoutMsSolver ?? options.deadlineMs;
  if (timeoutMs !== undefined) {
    requestOptions.timeout_ms = Math.trunc(timeoutMs);
  }
  if (config.minResponses !== undefined) {
    requestOptions.min_responses = config.minResponses;
  }
  if (config.maxGas !== undefined) {
    requestOptions.max_gas = config.maxGas.toString();
  }

  return { orders: [order], options: requestOptions };
}

/**
 * Builds a route DAG from the Fynd swap list.
 */
export function fyndRouteGraph(order: FyndOrderQuote, request: ExactInSwapParams): RouteGraph {
  const nodeMap = new Map<string, TokenNode>();
  const setNode = (address: Address) => {
    nodeMap.set(address.toLowerCase(), { address });
  };
  setNode(request.inputToken);
  setNode(request.outputToken);

  const edges: PoolEdge[] = [];
  for (const [index, swap] of (order.route?.swaps ?? []).entries()) {
    if (!isAddressLike(swap.token_in) || !isAddressLike(swap.token_out)) {
      continue;
    }
    setNode(swap.token_in);
    setNode(swap.token_out);
    edges.push({
      source: swap.token_in,
      target: swap.token_out,
      address: isAddressLike(swap.component_id) ? swap.component_id : undefined,
      key: swap.component_id ?? `${swap.protocol ?? "swap"}-${index}`,
      value: Number(swap.amount_in ?? 0),
    });
  }

  return { nodes: [...nodeMap.values()], edges };
}

function buildFyndFees(order: FyndOrderQuote, request: ExactInSwapParams): Fee[] | undefined {
  const fees: Fee[] = [];
  const routerFee = parseBigInt(order.fee_breakdown?.router_fee);
  if (routerFee !== undefined && routerFee > 0n) {
    fees.push({ type: "aggregator", token: request.outputToken, amount: routerFee });
  }
  const clientFee = parseBigInt(order.fee_breakdown?.client_fee);
  if (clientFee !== undefined && clientFee > 0n) {
    fees.push({ type: "integrator", token: request.outputToken, amount: clientFee });
  }
  return fees.length > 0 ? fees : undefined;
}

function buildFyndMetrics(order: FyndOrderQuote): QuoteMetrics | undefined {
  const bps = order.price_impact_bps;
  if (bps === undefined || bps === null || !Number.isFinite(bps)) {
    return undefined;
  }
  return { priceImpactBps: bps };
}

function isAddressLike(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseBigInt(value?: string | number | bigint | null): bigint | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

type FyndOrder = {
  token_in: Address;
  token_out: Address;
  amount: string;
  side: "sell";
  sender: Address;
  receiver?: Address;
};

type FyndQuoteOptions = {
  timeout_ms?: number;
  min_responses?: number;
  max_gas?: string;
  encoding_options?: {
    slippage: string;
    transfer_type?: "transfer_from" | "transfer_from_permit2";
    [key: string]: unknown;
  };
};

type FyndQuoteRequest = {
  orders: FyndOrder[];
  options?: FyndQuoteOptions;
};

export type FyndErrorResponse = {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type FyndQuoteStatus =
  | "success"
  | "no_route_found"
  | "insufficient_liquidity"
  | "timeout"
  | "not_ready"
  | "price_check_failed";

export type FyndSwap = {
  component_id?: string;
  protocol?: string;
  token_in?: Address;
  token_out?: Address;
  amount_in?: string;
  amount_out?: string;
  gas_estimate?: string;
  split?: string;
};

export type FyndTransaction = {
  to: Address;
  data: Hex;
  value: string;
  client_fee_signature_offset?: number | null;
};

export type FyndOrderQuote = {
  order_id: string;
  status: FyndQuoteStatus;
  amount_in: string;
  amount_out: string;
  amount_out_net_gas?: string;
  gas_estimate: string;
  gas_price?: string | null;
  price_impact_bps?: number | null;
  algorithm?: string | null;
  block?: { number: number; hash?: string; timestamp?: number };
  route?: { swaps: FyndSwap[] } | null;
  transaction?: FyndTransaction | null;
  fee_breakdown?: {
    router_fee?: string;
    client_fee?: string;
    max_slippage?: string;
    min_amount_received?: string;
  } | null;
  simulation_result?: unknown;
};

export type FyndQuoteResponse = {
  orders: FyndOrderQuote[];
  total_gas_estimate?: string;
  solve_time_ms?: number;
};
