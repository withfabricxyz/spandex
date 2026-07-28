import { type Address, zeroAddress } from "viem";
import {
  type AggregationOptions,
  type AggregatorFeature,
  type AggregatorMetadata,
  type ProviderConfig,
  type ProviderKey,
  type Quote,
  QuoteError,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
} from "../types.js";
import { Aggregator } from "./index.js";

const ODOS_DEPRECATION_MESSAGE =
  "The Odos provider is deprecated because Odos is shutting down. Remove odos() from your spanDEX provider configuration.";

/**
 * Configuration options for the Odos aggregator.
 *
 * @deprecated Odos is shutting down. Remove the Odos provider from your configuration.
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
 * Compatibility stub for the deprecated Odos routing API.
 *
 * @deprecated Odos is shutting down. This aggregator always returns a failed quote.
 */
export class OdosAggregator extends Aggregator<OdosConfig> {
  /**
   * @param config - Optional Odos-specific configuration such as referral codes.
   */
  constructor(config: OdosConfig = {}) {
    super(config);
    console.warn(`[spanDEX] ${ODOS_DEPRECATION_MESSAGE}`);
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
   * Returns a failed quote immediately without resolving options, retrying, or making a network
   * request.
   */
  override fetchQuote(_params: SwapParams, _options?: AggregationOptions): Promise<Quote> {
    return Promise.resolve({
      success: false,
      provider: "odos",
      error: new QuoteError(ODOS_DEPRECATION_MESSAGE),
      providerAttributes: this.config.attributes,
    });
  }

  protected override tryFetchQuote(
    _request: SwapParams,
    _options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    return Promise.reject(new QuoteError(ODOS_DEPRECATION_MESSAGE));
  }
}

/**
 * Convenience factory for creating an Odos aggregator instance.
 *
 * @param config - Optional Odos configuration.
 * @returns OdosAggregator instance.
 *
 * @deprecated Odos is shutting down. Remove the Odos provider from your configuration.
 */
export function odos(config?: OdosConfig): OdosAggregator {
  return new OdosAggregator(config);
}

/**
 * Response payload returned by the Odos `/sor/quote/v3` endpoint.
 *
 * Field semantics follow https://docs.odos.xyz/api/sor/quote.
 *
 * @deprecated Odos is shutting down and no new responses are produced by this provider.
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
