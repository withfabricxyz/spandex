import { zeroAddress } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ExactInSwapParams,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type QuoteMetrics,
  type SuccessfulQuote,
  type SwapParams,
  type TokenPricing,
} from "../types.js";
import { Aggregator } from "./index.js";

/**
 * Configuration options for the Odos aggregator.
 */
export type OdosConfig = ProviderConfig & {
  /**
   * Optional integrator identifier used for referral attribution.
   */
  referralCode?: number;
  /**
   * Optional API key for Odos.
   */
  apiKey?: string;
};

/**
 * Aggregator implementation for the Odos routing API.
 */
export class OdosAggregator extends Aggregator<OdosConfig> {
  /**
   * @param config - Optional Odos-specific configuration such as referral codes.
   */
  constructor(config: OdosConfig = {}) {
    super(config);
  }

  override metadata(): AggregatorMetadata {
    return {
      name: "Odos",
      url: "https://odos.xyz",
      docsUrl: "https://docs.odos.xyz/api/sor/quote",
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "odos";
  }

  /**
   * @inheritdoc
   */
  override features(): AggregatorFeature[] {
    return ["exactIn"];
  }

  /**
   * @inheritdoc
   *
   * Odos requires generating a quote to obtain a `pathId`, then assembling the transaction.
   */
  protected override async tryFetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    if (request.mode === "targetOut") {
      throw new QuoteError("0x aggregator does not support exact output quotes");
    }

    const response = await this.getQuote(request as ExactInSwapParams);
    // TODO: is this right? copied from kyber
    const networkFee =
      BigInt(response.gasEstimate) * BigInt(Math.round(response.gweiPerGas * 10 ** 9));

    const txData = await this.assembleOdosTx(response.pathId, request.swapperAccount);
    const outputAmount = BigInt(response.outAmounts[0] || "0");
    const inputAmount = BigInt(response.inAmounts[0] || "0");
    const pricing = buildOdosPricing(request as ExactInSwapParams);
    const metrics = buildOdosMetrics(response);

    return {
      success: true,
      provider: "odos",
      details: response,
      latency: 0,
      inputAmount,
      outputAmount,
      networkFee,
      txData,
      approval:
        request.inputToken !== zeroAddress
          ? {
              token: request.inputToken,
              spender: txData.to,
            }
          : undefined,
      pricing,
      metrics,
    };
  }

  private async getQuote({
    chainId,
    inputToken,
    outputToken,
    inputAmount,
    slippageBps,
    swapperAccount,
  }: ExactInSwapParams): Promise<OdosQuoteResponse> {
    const quoteGenParams: OdosQuoteRequest = {
      chainId,
      inputTokens: [
        {
          tokenAddress: inputToken,
          amount: inputAmount.toString(),
        },
      ],
      outputTokens: [
        {
          tokenAddress: outputToken,
          proportion: 1,
        },
      ],
      slippageLimitPercent: slippageBps / 100,
      userAddr: swapperAccount,
      compact: true,
      referralCode: this.config.referralCode,
    };

    const response = await fetch("https://api.odos.xyz/sor/quote/v3", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(quoteGenParams),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new QuoteError(`Odos API request failed with status ${response.status}`, body);
    }

    return response.json() as Promise<OdosQuoteResponse>;
  }

  private async assembleOdosTx(
    pathId: string,
    userAddr: `0x${string}`,
  ): Promise<{ to: `0x${string}`; data: `0x${string}`; value: bigint }> {
    const requestBody: OdosAssembleRequest = {
      userAddr,
      pathId,
      simulate: false,
    };

    const response = await fetch("https://api.odos.xyz/sor/assemble", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new QuoteError(`Odos tx assembly request failed with status ${response.status}`, body);
    }

    const data = (await response.json()) as OdosAssembleResponse;

    return {
      to: data.transaction.to,
      data: data.transaction.data,
      value: BigInt(data.transaction.value || 0),
    };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.apiKey) {
      headers["x-api-key"] = this.config.apiKey;
    }

    return headers;
  }
}

export function odos(config?: OdosConfig): OdosAggregator {
  return new OdosAggregator(config);
}

/**
 * Request payload accepted by the Odos `/sor/quote/v3` endpoint.
 *
 * Field semantics follow https://docs.odos.xyz/api/sor/quote.
 */
type OdosQuoteRequest = {
  /**
   * Chain identifier (EIP-155).
   */
  chainId: number;
  /**
   * Tokens and amounts the user will supply to the route (base units).
   */
  inputTokens: Array<{
    tokenAddress: `0x${string}`;
    amount: string;
  }>;
  /**
   * Tokens requested on output along with the percentage split for each leg.
   */
  outputTokens: Array<{
    tokenAddress: `0x${string}`;
    proportion: number;
  }>;
  /**
   * Maximum price movement tolerated, expressed as a percent (e.g. `0.5` = 0.5%).
   */
  slippageLimitPercent: number;
  /**
   * Recipient of funds and msg.sender for the assembled transaction.
   */
  userAddr: `0x${string}`;
  /**
   * Enables a spandexler payload by omitting verbose path details.
   */
  compact?: boolean;
  /**
   * Optional integrator identifier used for referral attribution.
   */
  referralCode?: number;
};

/**
 * Response payload returned by the Odos `/sor/quote/v3` endpoint.
 *
 * Field semantics follow https://docs.odos.xyz/api/sor/quote.
 */
export type OdosQuoteResponse = {
  /**
   * Opaque identifier used to assemble and simulate the routed transaction.
   */
  pathId: string;
  /**
   * ERC-20 addresses used on the input side of the route.
   */
  inTokens: string[];
  /**
   * ERC-20 addresses produced on the output side of the route.
   */
  outTokens: string[];
  /**
   * Base-unit amounts for each entry in `inTokens`.
   */
  inAmounts: string[];
  /**
   * Base-unit amounts for each entry in `outTokens`.
   */
  outAmounts: string[];
  /**
   * Estimated gas units required to execute the assembled transaction.
   */
  gasEstimate: number;
  /**
   * Portion of the gas estimate attributable to calldata size (EIP-1559 data gas).
   */
  dataGasEstimate: number;
  /**
   * Suggested gas price in gwei derived from Odos' gas oracle.
   */
  gweiPerGas: number;
  /**
   * Estimated fiat cost (USD) of the gas required to perform the swap.
   */
  gasEstimateValue: number;
  /**
   * Fiat valuation (USD) of each input amount.
   */
  inValues: number[];
  /**
   * Fiat valuation (USD) of each output amount.
   */
  outValues: number[];
  /**
   * Net USD value of the quote after accounting for gas and fees.
   */
  netOutValue: number;
  /**
   * Price impact of the path vs. mid price expressed as a percentage.
   */
  priceImpact: number;
  /**
   * Percent difference between the quoted path and Odos' benchmark route.
   */
  percentDiff: number;
  /**
   * Fee percentage applied on behalf of the integrator, if configured.
   */
  partnerFeePercent: number;
};

function buildOdosPricing(request: ExactInSwapParams): {
  inputToken: TokenPricing;
  outputToken: TokenPricing;
} {
  return {
    inputToken: {
      address: request.inputToken,
    },
    outputToken: {
      address: request.outputToken,
    },
  };
}

function buildOdosMetrics(response: OdosQuoteResponse): QuoteMetrics | undefined {
  if (!Number.isFinite(response.priceImpact)) {
    return undefined;
  }
  return {
    priceImpactBps: Math.round(response.priceImpact * 100),
  };
}

/**
 * Request payload accepted by the Odos `/sor/assemble` endpoint.
 *
 * Field semantics follow https://docs.odos.xyz/api/sor/assemble.
 */
type OdosAssembleRequest = {
  /**
   * Address that will submit the transaction and receive the proceeds.
   */
  userAddr: `0x${string}`;
  /**
   * Identifier returned by the quote endpoint tying the request to a specific path.
   */
  pathId: string;
  /**
   * Whether Odos should simulate execution server-side before returning calldata.
   */
  simulate?: boolean;
};

/**
 * Response payload returned by the Odos `/sor/assemble` endpoint.
 *
 * Field semantics follow https://docs.odos.xyz/api/sor/assemble.
 */
type OdosAssembleResponse = {
  transaction: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: string;
  };
};
