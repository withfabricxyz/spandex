import type { Address, Hex } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ExactInSwapParams,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenPricing,
} from "../types.js";
import { isNativeToken } from "../utils/helpers.js";
import { Aggregator } from "./index.js";

/**
 * Configuration options for the 0x aggregator.
 */
export type ZeroXConfig = ProviderConfig & {
  /** API key for accessing the 0x API. */
  apiKey: string;
};

/**
 * Aggregator implementation that sources quotes from the 0x API.
 */
export class ZeroXAggregator extends Aggregator<ZeroXConfig> {
  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "0x",
      url: "https://0x.org",
      docsUrl: "https://0x.org/docs/api#tag/Swap/operation/swap::allowanceHolder::getQuote",
      logoUrl:
        "https://cdn.prod.website-files.com/66967cfef0a246cbbb9aee94/66967cfef0a246cbbb9aeeee_logo.svg",
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "0x";
  }

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
      throw new QuoteError("0x aggregator does not support exact output quotes");
    }
    if (isNativeToken(request.inputToken)) {
      throw new QuoteError("0x aggregator does not support native input tokens");
    }

    const response = await this.makeRequest(request as ExactInSwapParams, options);
    const pricing = zeroXPricing(request, response);

    return {
      success: true,
      provider: "0x",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      inputAmount: BigInt(response.sellAmount),
      outputAmount: BigInt(response.buyAmount),
      networkFee: BigInt(response.totalNetworkFee || "0"),
      txData: {
        to: response.transaction.to,
        data: response.transaction.data,
        value: BigInt(response.transaction.value || "0"),
      },
      approval: response.allowanceTarget
        ? {
            token: response.sellToken,
            spender: response.allowanceTarget,
          }
        : undefined,
      route: zeroXRouteGraph(response),
      pricing,
    };
  }

  private async makeRequest(
    request: ExactInSwapParams,
    options: SwapOptions,
  ): Promise<ZeroXQuoteResponse> {
    if (!this.config.apiKey) {
      throw new Error("0x API key is not set. Please set the ZEROX_API_KEY environment variable.");
    }

    const params = new URLSearchParams(extractQueryParams(request, options));

    const response = await fetch(
      `https://api.0x.org/swap/allowance-holder/quote?${params.toString()}`,
      {
        headers: {
          accept: "application/json",
          "0x-api-key": this.config.apiKey,
          "0x-version": "v2",
        },
      },
    );

    const body = await response.json();
    if (!response.ok) {
      throw new QuoteError(`0x API request failed with status ${response.status}`, body);
    }
    return body as ZeroXQuoteResponse;
  }
}

/**
 * Convenience factory for creating a 0x aggregator instance.
 *
 * @param config - 0x configuration (API key, timeouts, negotiated features).
 * @returns ZeroXAggregator instance.
 */
export function zeroX(config: ZeroXConfig): ZeroXAggregator {
  return new ZeroXAggregator(config);
}

function extractQueryParams(
  params: ExactInSwapParams,
  options: SwapOptions,
): Record<string, string> {
  const result: Record<string, string> = {
    chainId: params.chainId.toString(),
    buyToken: params.outputToken,
    sellToken: params.inputToken,
    sellAmount: params.inputAmount.toString(),
    slippageBps: params.slippageBps.toString(),
    taker: params.swapperAccount,
  };

  if (options.integratorFeeAddress) {
    result.swapFeeRecipient = options.integratorFeeAddress;
    if (options.integratorSwapFeeBps !== undefined) {
      result.swapFeeBps = options.integratorSwapFeeBps.toString();
    }
    if (options.integratorSurplusBps) {
      result.tradeSurplusRecipient = options.integratorFeeAddress;
      result.tradeSurplusMaxBps = options.integratorSurplusBps.toString();
    }
  }

  return result;
}

function zeroXRouteGraph(quote: ZeroXQuoteResponse): RouteGraph {
  const route = quote.route;
  const nodes = route.tokens.map((token) => ({
    address: token.address,
    symbol: token.symbol,
  }));

  const edges = route.fills.map((fill) => ({
    source: fill.from,
    target: fill.to,
    key: fill.source,
    value: Number(fill.proportionBps),
  }));

  return {
    nodes,
    edges,
  };
}

function zeroXPricing(request: ExactInSwapParams, quote: ZeroXQuoteResponse) {
  const inputToken = zeroXTokenPricing(request.inputToken, quote);
  const outputToken = zeroXTokenPricing(request.outputToken, quote);

  return {
    inputToken,
    outputToken,
  };
}

function zeroXTokenPricing(address: Address, quote: ZeroXQuoteResponse): TokenPricing {
  const token = quote.route.tokens.find(
    (entry) => entry.address.toLowerCase() === address.toLowerCase(),
  );
  return {
    address,
    symbol: token?.symbol,
  };
}

//////// Types /////////
// Extracted from 0x API documentation with GPT5
////////////////////////

// fees
interface SwapFees {
  /**
   * These are currently returned as `null` in the public examples.
   * When present, they’re documented as sub-objects but the exact
   * structure isn't fully specified in the HTML docs, so keep them
   * as unknown for now.
   */
  integratorFee: unknown | null;
  zeroExFee: unknown | null;
  gasFee: unknown | null;
}

// issues

interface SwapAllowanceIssue {
  actual: string;
  spender: Address;
}

interface SwapBalanceIssue {
  token: Address;
  actual: string;
  expected: string;
}

interface SwapIssues {
  /**
   * Present when there is an allowance issue; omitted otherwise.
   */
  allowance?: SwapAllowanceIssue;

  /**
   * Present when there is a balance issue; omitted otherwise.
   */
  balance?: SwapBalanceIssue;

  /**
   * true if their internal simulation couldn’t fully complete.
   */
  simulationIncomplete: boolean;

  /**
   * Any liquidity sources you passed that 0x considers invalid.
   */
  invalidSourcesPassed: string[];
}

// route

interface SwapRouteFill {
  from: Address;
  to: Address;
  /**
   * Liquidity source name, e.g. "SolidlyV3", "UniswapV3", etc.
   */
  source: string;
  /**
   * Portion of total in basis points (0–10000).
   */
  proportionBps: string;
}

interface SwapRouteToken {
  address: Address;
  symbol: string;
}

interface SwapRoute {
  fills: SwapRouteFill[];
  tokens: SwapRouteToken[];
}

// tokenMetadata

interface SwapTokenTaxMetadata {
  buyTaxBps: string;
  sellTaxBps: string;
}

interface SwapTokenMetadata {
  buyToken: SwapTokenTaxMetadata;
  sellToken: SwapTokenTaxMetadata;
}

// transaction (from getQuote response)

interface SwapTransaction {
  to: Address;
  data: Hex;
  gas: string;
  gasPrice: string;
  value: string;
}

// ----------------- Main response type -----------------

/**
 * 0x Swap getQuote (Allowance Holder) response payload.
 * Endpoint: GET /swap/allowance-holder/quote
 */
export interface ZeroXQuoteResponse {
  /**
   * Target contract address that needs allowance, or null for
   * native-asset flows where no allowance is needed.
   */
  allowanceTarget: Address | null;

  /**
   * Block number at which liquidity was sampled.
   */
  blockNumber: string;

  /**
   * Amount of buyToken (in buyToken base units) that will be bought.
   */
  buyAmount: string;

  /**
   * Contract address of the token to buy.
   */
  buyToken: Address;

  /**
   * Fee breakdown (often nulls for now).
   */
  fees: SwapFees;

  /**
   * Potential execution issues (allowance, balance, simulation).
   */
  issues: SwapIssues;

  /**
   * Liquidity is available for this quote. For a successful quote,
   * docs indicate this will be true.
   */
  liquidityAvailable: true;

  /**
   * Minimum buy amount; tx reverts if this isn’t met.
   */
  minBuyAmount: string;

  /**
   * Path of liquidity used to execute the swap.
   */
  route: SwapRoute;

  /**
   * Amount of sellToken (in sellToken base units) that will be sold.
   */
  sellAmount: string;

  /**
   * Contract address of the token to sell.
   */
  sellToken: Address;

  /**
   * Tax/metadata for buy and sell tokens.
   */
  tokenMetadata: SwapTokenMetadata;

  /**
   * Estimated total network fee, or null when not provided.
   */
  totalNetworkFee: string | null;

  /**
   * Fully formed transaction to submit on-chain.
   */
  transaction: SwapTransaction;

  /**
   * Unique ZeroEx identifier of the request.
   */
  zid: string;
}
