import { type Address, formatUnits, type Hex, parseUnits } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ExactInSwapParams,
  type PoolEdge,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type QuotePricing,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenNode,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { Aggregator } from "./index.js";

const MOBULA_DOCS_URL = "https://docs.mobula.io/guides/complete-swap-guide";
const DEFAULT_BASE_URL = "https://api.mobula.io/api/2";
const MOBULA_NATIVE_TOKEN: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * Configuration options for the Mobula aggregator.
 */
export type MobulaConfig = ProviderConfig & {
  /**
   * API key sent as a bearer token in the `Authorization` header.
   * Obtain one at https://admin.mobula.io.
   */
  apiKey: string;
  /**
   * Base URL for the Mobula API. Defaults to `https://api.mobula.io/api/2`.
   */
  baseUrl?: string;
  /**
   * DEX allow list forwarded as `onlyProtocols`.
   */
  onlyProtocols?: string[];
  /**
   * DEX deny list forwarded as `excludedProtocols`.
   */
  excludedProtocols?: string[];
  /**
   * Upstream aggregator filter forwarded as `onlyRouters` (e.g. `kyberswap`, `lifi`).
   */
  onlyRouters?: string[];
};

/**
 * Aggregator implementation for the Mobula swap API (EVM only).
 *
 * Mobula exposes `GET /swap/quoting` which returns a quote together with an
 * unsigned EVM transaction, so a single request yields executable calldata.
 * Chain support is not enforced client-side; Mobula rejects unsupported
 * chains with an error envelope that surfaces as a failed quote.
 *
 * @see https://docs.mobula.io/guides/complete-swap-guide
 */
export class MobulaAggregator extends Aggregator<MobulaConfig> {
  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "mobula",
      url: "https://mobula.io",
      docsUrl: MOBULA_DOCS_URL,
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "mobula";
  }

  /**
   * Mobula uses the EIP-7528 sentinel address for native tokens.
   */
  override nativeTokenAddress(): Address {
    return MOBULA_NATIVE_TOKEN;
  }

  /**
   * @inheritdoc
   */
  override features(): AggregatorFeature[] {
    return ["exactIn", "integratorFees"];
  }

  /**
   * @inheritdoc
   */
  protected override async tryFetchQuote(
    request: SwapParams,
    options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    if (request.mode === "targetOut") {
      throw new QuoteError("mobula aggregator does not support exact output quotes");
    }

    if ((request.outputChainId ?? request.chainId) !== request.chainId) {
      throw new QuoteError("mobula aggregator does not support cross-chain quotes");
    }

    const data = await this.quote(request as ExactInSwapParams, options);
    const tx = data.evm?.transaction;
    if (!tx) {
      throw new QuoteError("mobula quote did not include an EVM transaction", data);
    }

    const outputAmount = resolveOutputAmount(data);
    const txValue = parseBigInt(tx.value) ?? 0n;
    const gas = parseBigInt(tx.gasLimit);
    const gasPrice = parseBigInt(tx.maxFeePerGas ?? tx.gasPrice);
    const networkFee = gas !== undefined && gasPrice !== undefined ? gas * gasPrice : 0n;

    return {
      success: true,
      provider: "mobula",
      details: data,
      latency: 0,
      inputChainId: request.chainId,
      outputChainId: request.chainId,
      execution: "atomic",
      inputAmount: request.inputAmount,
      outputAmount,
      networkFee,
      txData: {
        to: tx.to,
        data: tx.data,
        ...(txValue > 0n ? { value: txValue } : {}),
        ...(gas !== undefined ? { gas } : {}),
      },
      approval: !isNativeToken(request.inputToken)
        ? {
            token: request.inputToken,
            spender: tx.approvalAddress ?? tx.approvals?.[0]?.spender ?? tx.to,
          }
        : undefined,
      route: mobulaRouteGraph(data),
      pricing: buildMobulaPricing(request as ExactInSwapParams, data, outputAmount),
    };
  }

  private async quote(
    request: ExactInSwapParams,
    options: SwapOptions,
  ): Promise<MobulaQuoteResponse> {
    if (!this.config.apiKey) {
      throw new Error(
        "mobula API key is not set. Please set the MOBULA_API_KEY environment variable.",
      );
    }

    const query = buildQueryParams(request, options, this.config, this.supportsFeature.bind(this));
    const response = await fetch(`${this.baseUrl()}/swap/quoting?${query.toString()}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    const body = (await response.json().catch(() => undefined)) as MobulaQuoteEnvelope | undefined;
    if (!response.ok) {
      throw new QuoteError(`mobula API request failed with status ${response.status}`, body);
    }
    if (!body?.data) {
      throw new QuoteError(body?.error ?? "mobula API returned no quote data", body);
    }

    return body.data;
  }

  private baseUrl() {
    return (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }
}

/**
 * Convenience factory for creating a Mobula aggregator instance.
 *
 * @param config - Mobula configuration.
 * @returns MobulaAggregator instance.
 */
export function mobula(config: MobulaConfig): MobulaAggregator {
  return new MobulaAggregator(config);
}

function buildQueryParams(
  params: ExactInSwapParams,
  options: SwapOptions,
  config: MobulaConfig,
  supportsFeature: (feature: AggregatorFeature) => boolean,
): URLSearchParams {
  const query = new URLSearchParams({
    chainId: `evm:${params.chainId}`,
    tokenIn: params.inputToken,
    tokenOut: params.outputToken,
    amountRaw: params.inputAmount.toString(),
    walletAddress: params.swapperAccount,
    slippage: bpsToPercent(params.slippageBps),
  });

  const recipient = params.recipientAccount ?? params.swapperAccount;
  if (recipient.toLowerCase() !== params.swapperAccount.toLowerCase()) {
    query.set("recipientAddress", recipient);
  }

  if (
    options.integratorSwapFeeBps !== undefined &&
    options.integratorSwapFeeBps > 0 &&
    options.integratorFeeAddress &&
    supportsFeature("integratorFees")
  ) {
    query.set("feePercentages", bpsToPercent(options.integratorSwapFeeBps));
    query.set("feeWallets", options.integratorFeeAddress);
  }

  if (config.onlyProtocols?.length) {
    query.set("onlyProtocols", config.onlyProtocols.join(","));
  }
  if (config.excludedProtocols?.length) {
    query.set("excludedProtocols", config.excludedProtocols.join(","));
  }
  if (config.onlyRouters?.length) {
    query.set("onlyRouters", config.onlyRouters.join(","));
  }

  return query;
}

function bpsToPercent(bps: number): string {
  return (bps / 100).toString();
}

/**
 * Mobula reports the output as a human-readable decimal string. Prefer a raw
 * field when present, otherwise scale by the output token decimals.
 */
function resolveOutputAmount(data: MobulaQuoteResponse): bigint {
  const raw = parseBigInt(data.amountOutRaw);
  if (raw !== undefined) {
    return raw;
  }
  const decimals = data.tokenOut?.decimals;
  if (data.amountOutTokens === undefined || decimals === undefined) {
    return 0n;
  }
  try {
    return parseUnits(data.amountOutTokens, decimals);
  } catch {
    return 0n;
  }
}

/**
 * Builds a route DAG from the Mobula hop list. Hops that omit token addresses
 * are chained sequentially from `tokenIn` to `tokenOut`.
 */
export function mobulaRouteGraph(data: MobulaQuoteResponse): RouteGraph {
  const nodeMap = new Map<string, TokenNode>();
  const setNode = (address: Address) => {
    nodeMap.set(address.toLowerCase(), { address });
  };

  const tokenIn = data.tokenIn?.address;
  const tokenOut = data.tokenOut?.address;
  if (isAddressLike(tokenIn)) setNode(tokenIn);
  if (isAddressLike(tokenOut)) setNode(tokenOut);

  const hops = data.details?.route?.hops ?? [];
  const edges: PoolEdge[] = [];
  let previous: Address | undefined = isAddressLike(tokenIn) ? tokenIn : undefined;

  for (const [index, hop] of hops.entries()) {
    const source = isAddressLike(hop.tokenIn) ? hop.tokenIn : previous;
    const isLast = index === hops.length - 1;
    const target = isAddressLike(hop.tokenOut)
      ? hop.tokenOut
      : isLast && isAddressLike(tokenOut)
        ? tokenOut
        : undefined;
    if (!source || !target) {
      continue;
    }
    setNode(source);
    setNode(target);
    edges.push({
      source,
      target,
      address: isAddressLike(hop.poolAddress) ? hop.poolAddress : undefined,
      key: hop.poolAddress ?? `${hop.exchange ?? "hop"}-${index}`,
      value: Number(hop.amountInRaw ?? 0),
    });
    previous = target;
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
  };
}

function buildMobulaPricing(
  request: ExactInSwapParams,
  data: MobulaQuoteResponse,
  outputAmount: bigint,
): QuotePricing {
  return {
    inputToken: {
      address: request.inputToken,
      usdPrice: unitPrice(data.amountInUSD, request.inputAmount, data.tokenIn?.decimals),
    },
    outputToken: {
      address: request.outputToken,
      usdPrice: unitPrice(data.amountOutUSD, outputAmount, data.tokenOut?.decimals),
    },
  };
}

function unitPrice(usd?: number, amount?: bigint, decimals?: number): number | undefined {
  if (!Number.isFinite(usd) || amount === undefined || amount === 0n || decimals === undefined) {
    return undefined;
  }
  const units = Number(formatUnits(amount, decimals));
  return units > 0 ? (usd as number) / units : undefined;
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

export type MobulaQuoteEnvelope = {
  data: MobulaQuoteResponse | null;
  error?: string;
};

export type MobulaTokenInfo = {
  address: Address;
  symbol?: string;
  name?: string;
  decimals: number;
  logo?: string;
};

export type MobulaRouteHop = {
  poolAddress?: string;
  exchange?: string;
  poolType?: string;
  tokenIn?: Address;
  tokenOut?: Address;
  feeBps?: number;
  feePercentage?: number;
  marketImpactPercentage?: number;
  amountInTokens?: string;
  amountOutTokens?: string;
  amountInRaw?: string;
  amountOutRaw?: string;
  [key: string]: unknown;
};

export type MobulaEvmTransaction = {
  to: Address;
  from?: Address;
  data: Hex;
  value: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  chainId: number;
  approvalAddress?: Address;
  approvals?: { token: Address; spender: Address }[];
};

export type MobulaQuoteResponse = {
  amountOutTokens?: string;
  amountOutRaw?: string;
  amountInUSD?: number;
  amountOutUSD?: number;
  slippagePercentage?: number;
  marketImpactPercentage?: number;
  poolFeesPercentage?: number;
  tokenIn?: MobulaTokenInfo;
  tokenOut?: MobulaTokenInfo;
  requestId?: string;
  details?: {
    route?: {
      hops?: MobulaRouteHop[];
      aggregator?: string;
    };
  };
  fee?: {
    amount?: string;
    percentage?: number;
    wallet?: string;
    deductedFrom?: "input" | "output";
  };
  evm?: {
    transaction?: MobulaEvmTransaction;
  } | null;
  [key: string]: unknown;
};
