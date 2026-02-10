import type { Address } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type Fee,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type QuoteMetrics,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenPricing,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { computeUsdPriceFromValue } from "../util/pricing.js";
import { Aggregator } from "./index.js";

/**
 * Configuration options for the Relay aggregator.
 */
export type RelayConfig = ProviderConfig & {
  url?: string;
};

/**
 * Aggregator implementation for the Relay routing API.
 */
export class RelayAggregator extends Aggregator<RelayConfig> {
  constructor(config: RelayConfig = {}) {
    super(config);
  }

  override metadata(): AggregatorMetadata {
    return {
      name: "Relay",
      url: "https://relay.link",
      docsUrl: "https://docs.relay.link/references/api/get-quote",
    };
  }

  override name(): ProviderKey {
    return "relay";
  }

  override features(): AggregatorFeature[] {
    return ["exactIn", "targetOut", "integratorFees"];
  }

  protected override async tryFetchQuote(
    request: SwapParams,
    options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    const payload = buildRequest(request, options);
    const response = await fetch(`${this.config.url || "https://api.relay.link"}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as RelayQuoteResponse;
    if (!response.ok) {
      throw new QuoteError(`Relay API request failed with status ${response.status}`, body);
    }

    const tx = extractTransaction(body);
    if (!tx) {
      throw new QuoteError("Relay API response missing transaction data", body);
    }

    const inputAmount =
      parseAmount(body.details?.currencyIn?.amount) ||
      (request.mode === "exactIn" ? request.inputAmount : 0n);
    const outputAmount =
      parseAmount(body.details?.currencyOut?.amount) ||
      (request.mode === "targetOut" ? request.outputAmount : 0n);

    const txData: SuccessfulQuote["txData"] = {
      to: tx.to,
      data: tx.data,
    };
    if (tx.value !== undefined) {
      txData.value = BigInt(tx.value);
    }

    const pricing = buildRelayPricing(request, body);
    const fees = buildRelayFees(body);
    const metrics = buildRelayMetrics(body);

    return {
      success: true,
      provider: "relay",
      details: body,
      latency: 0,
      inputAmount,
      outputAmount,
      networkFee: body.fees?.gas ? BigInt(body.fees.gas.amount) : 0n,
      txData,
      approval: !isNativeToken(request.inputToken)
        ? {
            token: request.inputToken,
            spender: txData.to,
          }
        : undefined,
      pricing,
      fees,
      metrics,
    };
  }
}

/**
 * Convenience factory for creating a Relay aggregator instance.
 *
 * @param config - Optional Relay configuration.
 * @returns RelayAggregator instance.
 */
export function relay(config?: RelayConfig): RelayAggregator {
  return new RelayAggregator(config);
}

function buildRequest(request: SwapParams, options: SwapOptions): RelayQuoteRequest {
  const tradeType = request.mode === "exactIn" ? "EXACT_INPUT" : "EXPECTED_OUTPUT";
  const amount = request.mode === "exactIn" ? request.inputAmount : request.outputAmount;
  const recipientAccount = request.recipientAccount ?? request.swapperAccount;

  const appFees: RelayQuoteRequest["appFees"] = [];
  if (options.integratorFeeAddress !== undefined && options.integratorSwapFeeBps !== undefined) {
    appFees.push({
      recipient: options.integratorFeeAddress,
      fee: options.integratorSwapFeeBps.toString(),
    });
  }

  const payload: RelayQuoteRequest = {
    user: request.swapperAccount,
    recipient: recipientAccount,
    originChainId: request.chainId,
    destinationChainId: request.chainId,
    originCurrency: request.inputToken,
    destinationCurrency: request.outputToken,
    slippageTolerance: request.slippageBps.toString(),
    amount: amount.toString(),
    tradeType,
    protocolVersion: "v2",
    appFees,
  };

  // Relay expects slippage values as percentage strings (e.g. "0.5" for 50 bps).
  payload.slippageTolerance = (request.slippageBps / 100).toString();

  return payload;
}

// Note: this will need to be adjusted for multi-step / cross-chain swaps in the future.
function extractTransaction(response: RelayQuoteResponse): RelayTransaction | null {
  const step = (response.steps || []).find((step) => step.id === "swap");
  if (!step) {
    return null;
  }
  const items = step.items || [];
  for (const item of items) {
    const data = item.data;
    if (data?.to && data?.data) {
      return data;
    }
  }

  return null;
}

function parseAmount(value?: string | number | null): bigint | null {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function buildRelayPricing(
  request: SwapParams,
  response: RelayQuoteResponse,
): { inputToken: TokenPricing; outputToken: TokenPricing } {
  const inputToken = relayTokenPricing(request.inputToken, response.details?.currencyIn);
  const outputToken = relayTokenPricing(request.outputToken, response.details?.currencyOut);
  return {
    inputToken,
    outputToken,
  };
}

function relayTokenPricing(
  fallbackAddress: Address,
  currencyAmount?: RelayCurrencyAmount,
): TokenPricing {
  const currency = currencyAmount?.currency;
  const address = currency?.address ?? fallbackAddress;
  const usdValue = toNumber(currencyAmount?.amountUsd);
  const amount = parseAmount(currencyAmount?.amount || null);
  const usdPrice =
    amount !== null ? computeUsdPriceFromValue(amount, currency?.decimals, usdValue) : undefined;

  return {
    address,
    symbol: currency?.symbol,
    decimals: currency?.decimals,
    logoURI: currency?.metadata?.logoURI,
    usdPrice,
  };
}

function buildRelayFees(response: RelayQuoteResponse): Fee[] | undefined {
  if (!response.fees) {
    return undefined;
  }

  const breakdown: Fee[] = [];

  for (const [key, fee] of Object.entries(response.fees)) {
    if (!fee) continue;
    const amount = parseAmount(fee.amount);

    breakdown.push({
      type: relayFeeType(key),
      token: fee.currency.address,
      amount: amount ?? undefined,
    });
  }

  return breakdown.length > 0 ? breakdown : undefined;
}

function relayFeeType(key: string): Fee["type"] {
  switch (key) {
    case "gas":
      return "network";
    case "relayer":
    case "relayerGas":
    case "relayerService":
      return "relayer";
    case "app":
      return "app";
    default:
      return "other";
  }
}

function buildRelayMetrics(response: RelayQuoteResponse): QuoteMetrics | undefined {
  const percent =
    toNumber(response.details?.totalImpact?.percent) ??
    toNumber(response.details?.swapImpact?.percent);

  if (percent === undefined) {
    return undefined;
  }

  return {
    priceImpactBps: Math.round(percent * 100),
  };
}

function toNumber(value?: string | number | null): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

/////////// Types ///////////

type RelayTradeType = "EXACT_INPUT" | "EXACT_OUTPUT" | "EXPECTED_OUTPUT";

type RelayCurrency = {
  chainId: number;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  metadata?: {
    logoURI?: string;
    verified?: boolean;
    isNative?: boolean;
  };
};

type RelayCurrencyAmount = {
  currency: RelayCurrency;
  amount: string;
  amountFormatted?: string;
  amountUsd?: string;
  minimumAmount?: string;
};

type RelayFeeBreakdown = {
  currency: RelayCurrency;
  amount: string;
  amountFormatted?: string;
  amountUsd?: string;
  minimumAmount?: string;
};

type RelayTransaction = {
  from?: Address;
  to: Address;
  data: `0x${string}`;
  value?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: number;
};

type RelayStep = {
  id: string;
  action: string;
  description?: string;
  kind?: string;
  requestId?: string;
  items?: Array<{
    status?: string;
    data?: RelayTransaction;
  }>;
};

type RelayQuoteRequest = {
  user: Address;
  originChainId: number;
  destinationChainId: number;
  originCurrency: Address;
  destinationCurrency: Address;
  amount: string;
  tradeType: RelayTradeType;
  recipient: Address;
  slippageTolerance?: string;
  protocolVersion?: "v1" | "v2" | "preferV2";
  appFees?: Array<{
    recipient: Address;
    fee: string;
  }>;
};

/**
 * Response shape for the Relay `POST /quote` endpoint, condensed from the documentation example.
 */
export type RelayQuoteResponse = {
  steps?: RelayStep[];
  fees?: {
    gas?: RelayFeeBreakdown;
    relayer?: RelayFeeBreakdown;
    relayerGas?: RelayFeeBreakdown;
    relayerService?: RelayFeeBreakdown;
    app?: RelayFeeBreakdown;
    subsidized?: RelayFeeBreakdown;
    outputCurrency?: RelayFeeBreakdown;
  };
  details?: {
    operation?: string;
    sender?: Address;
    recipient?: Address;
    currencyIn?: RelayCurrencyAmount;
    currencyOut?: RelayCurrencyAmount;
    refundCurrency?: RelayCurrencyAmount;
    currencyGasTopup?: RelayCurrencyAmount;
    totalImpact?: { usd?: string; percent?: string };
    swapImpact?: { usd?: string; percent?: string };
    rate?: string;
    slippageTolerance?: {
      origin?: { usd?: string; value?: string; percent?: string };
      destination?: { usd?: string; value?: string; percent?: string };
    };
    timeEstimate?: number;
    router?: Address;
    includedSwapSources?: string[];
    route: {
      origin: unknown;
      destination: unknown;
    };
  };
  protocol?: {
    v2?: {
      orderId?: string;
      orderData?: unknown;
      paymentDetails?: {
        chainId?: string;
        depository?: string;
        currency?: string;
        amount?: string;
      };
    };
  };
};
