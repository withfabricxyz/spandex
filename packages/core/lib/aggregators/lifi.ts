import { type Address, zeroAddress } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ExactInSwapParams,
  type Fee,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenPricing,
} from "../types.js";
import { computeUsdPriceFromValue } from "../util/pricing.js";
import { Aggregator } from "./index.js";

const DEFAULT_BASE_URL = "https://li.quest/v1";

/**
 * Configuration options for the LI.FI aggregator.
 */
export type LifiConfig = ProviderConfig & {
  /**
   * Optional LI.FI API key.
   */
  apiKey?: string;
};

/**
 * Aggregator implementation that sources quotes from the LI.FI API.
 */
export class LifiAggregator extends Aggregator<LifiConfig> {
  constructor(config: LifiConfig = {}) {
    super(config);
  }

  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "LI.FI",
      url: "https://li.fi",
      docsUrl: "https://docs.li.fi/api-reference/get-a-quote-for-a-token-transfer",
      logoUrl: "https://li.fi/favicon.ico",
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "lifi";
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
      throw new QuoteError("LI.FI aggregator does not support exact output quotes");
    }

    const response = await this.getQuote(request as ExactInSwapParams, options);
    const estimate = response.estimate;
    if (!estimate) {
      throw new QuoteError("LI.FI API response missing estimate data", response);
    }

    const tx = response.transactionRequest;
    if (!tx?.to || !tx?.data) {
      throw new QuoteError("LI.FI API response missing transaction data", response);
    }

    const inputAmount = parseAmount(estimate.fromAmount) ?? request.inputAmount;
    const outputAmount = parseAmount(estimate.toAmount) ?? 0n;
    const txData: SuccessfulQuote["txData"] = {
      to: tx.to,
      data: tx.data,
    };
    if (tx.value) {
      const value = parseAmount(tx.value);
      if (value !== null) {
        txData.value = value;
      }
    }

    const approval =
      request.inputToken !== zeroAddress && estimate.approvalAddress
        ? {
            token: request.inputToken,
            spender: estimate.approvalAddress,
          }
        : undefined;

    const pricing = buildLifiPricing(request as ExactInSwapParams, response);
    const fees = buildLifiFees(response);

    return {
      success: true,
      provider: "lifi",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      inputAmount,
      outputAmount,
      networkFee: buildLifiNetworkFee(response),
      txData,
      approval,
      pricing,
      fees,
    };
  }

  private async getQuote(
    request: ExactInSwapParams,
    options: SwapOptions,
  ): Promise<LifiQuoteResponse> {
    const params = new URLSearchParams(buildQueryParams(request, options));
    const url = `${DEFAULT_BASE_URL}/quote?${params.toString()}`;
    const response = await fetch(url, { headers: this.headers() });
    const body = (await response.json()) as LifiQuoteResponse;
    if (!response.ok) {
      throw new QuoteError(`LI.FI API request failed with status ${response.status}`, body);
    }
    return body;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    if (this.config.apiKey) {
      // TODO: confirm the correct LI.FI API key header name.
      headers["x-lifi-api-key"] = this.config.apiKey;
    }
    return headers;
  }
}

function buildQueryParams(params: ExactInSwapParams, options: SwapOptions): Record<string, string> {
  const result: Record<string, string> = {
    fromChain: params.chainId.toString(),
    toChain: params.chainId.toString(),
    fromToken: params.inputToken,
    toToken: params.outputToken,
    fromAmount: params.inputAmount.toString(),
    fromAddress: params.swapperAccount,
    toAddress: params.swapperAccount,
    slippage: (params.slippageBps / 10_000).toString(),
  };

  if (options.integratorFeeAddress && options.integratorSwapFeeBps !== undefined) {
    result.integrator = options.integratorFeeAddress;
    result.fee = (options.integratorSwapFeeBps / 10_000).toString();
  }

  return result;
}

function buildLifiPricing(
  request: ExactInSwapParams,
  response: LifiQuoteResponse,
): { inputToken: TokenPricing; outputToken: TokenPricing } {
  const action = response.action;
  const estimate = response.estimate;
  const inputToken = lifiTokenPricing(
    request.inputToken,
    action?.fromToken,
    estimate?.fromAmount,
    estimate?.fromAmountUSD,
  );
  const outputToken = lifiTokenPricing(
    request.outputToken,
    action?.toToken,
    estimate?.toAmount,
    estimate?.toAmountUSD,
  );

  return { inputToken, outputToken };
}

function lifiTokenPricing(
  fallbackAddress: Address,
  token?: LifiToken,
  amount?: string,
  amountUsd?: string,
): TokenPricing {
  const parsedAmount = parseAmount(amount);
  const usdValue = toNumber(amountUsd);
  const computedUsdPrice =
    parsedAmount !== null
      ? computeUsdPriceFromValue(parsedAmount, token?.decimals, usdValue)
      : undefined;
  const tokenUsdPrice = toNumber(token?.priceUSD);

  return {
    address: token?.address ?? fallbackAddress,
    symbol: token?.symbol,
    decimals: token?.decimals,
    logoURI: token?.logoURI,
    usdPrice: computedUsdPrice ?? tokenUsdPrice,
  };
}

function buildLifiFees(response: LifiQuoteResponse): Fee[] | undefined {
  const feeCosts = response.estimate?.feeCosts;
  if (!feeCosts || feeCosts.length === 0) {
    return undefined;
  }

  const fees: Fee[] = [];
  for (const fee of feeCosts) {
    const amount = parseAmount(fee.amount);
    fees.push({
      type: lifiFeeType(fee),
      token: fee.token?.address,
      amount: amount ?? undefined,
    });
  }

  return fees.length > 0 ? fees : undefined;
}

function lifiFeeType(fee: LifiFeeCost): Fee["type"] {
  const label = fee.name?.toLowerCase() || "";
  if (label.includes("gas")) return "network";
  if (label.includes("integrator")) return "integrator";
  if (label.includes("relayer") || label.includes("relay")) return "relayer";
  if (label.includes("app")) return "app";
  // TODO: confirm LI.FI fee categories.
  return "other";
}

function buildLifiNetworkFee(response: LifiQuoteResponse): bigint {
  const gasCosts = response.estimate?.gasCosts ?? [];
  let total = 0n;

  for (const cost of gasCosts) {
    const amount = parseAmount(cost.amount);
    if (amount !== null) {
      total += amount;
    }
  }

  if (total > 0n) {
    return total;
  }

  const tx = response.transactionRequest;
  const gasLimit = parseAmount(tx?.gasLimit);
  const gasPrice = parseAmount(tx?.gasPrice ?? tx?.maxFeePerGas);

  if (gasLimit !== null && gasPrice !== null) {
    return gasLimit * gasPrice;
  }

  return 0n;
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

//////// Types /////////
// Extracted from LI.FI API documentation with GPT5
////////////////////////

export type LifiToken = {
  address: Address;
  chainId: number;
  symbol: string;
  name?: string;
  decimals: number;
  logoURI?: string;
  coinKey?: string;
  priceUSD?: string;
  // TODO: confirm additional token fields (e.g. "isNative", "isWrapped").
};

export type LifiAction = {
  fromChainId: number;
  toChainId: number;
  fromToken: LifiToken;
  toToken: LifiToken;
  fromAddress: Address;
  toAddress: Address;
  // TODO: confirm slippage units (percentage vs ratio).
  slippage?: number;
  // TODO: confirm whether fromAmount/toAmount are included here.
};

export type LifiFeeCost = {
  name?: string;
  description?: string;
  token?: LifiToken;
  amount?: string;
  amountUSD?: string;
  percentage?: string;
  included?: boolean;
};

export type LifiGasCost = {
  type?: string;
  price?: string;
  amount?: string;
  amountUSD?: string;
  token?: LifiToken;
  estimate?: string;
  limit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

export type LifiEstimate = {
  fromAmount?: string;
  toAmount?: string;
  toAmountMin?: string;
  fromAmountUSD?: string;
  toAmountUSD?: string;
  approvalAddress?: Address;
  executionDuration?: number;
  gasCosts?: LifiGasCost[];
  feeCosts?: LifiFeeCost[];
  // TODO: confirm whether price impact or route fields are included.
};

export type LifiTransactionRequest = {
  to: Address;
  data: `0x${string}`;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: number;
  from?: Address;
  // TODO: confirm additional transaction request fields.
};

/**
 * LI.FI quote response payload.
 * GET /quote
 */
export type LifiQuoteResponse = {
  action?: LifiAction;
  estimate?: LifiEstimate;
  transactionRequest?: LifiTransactionRequest;
  // TODO: confirm response metadata fields like "id", "type", or "tool".
};
