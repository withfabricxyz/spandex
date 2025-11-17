import { Aggregator } from "../aggregator.js";
import {
  type Address,
  type ExactInSwapParams,
  type Hex,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapParams,
} from "../types.js";

export type ZeroXConfig = {
  apiKey: string;
};

/**
 * Aggregator implementation that sources quotes from the 0x API.
 */
export class ZeroXAggregator extends Aggregator {
  /**
   * @param config - 0x-specific configuration, currently just the API key.
   */
  constructor(private config: ZeroXConfig) {
    super();
  }

  /**
   * @inheritdoc
   */
  name(): ProviderKey {
    return "0x";
  }

  /**
   * @inheritdoc
   */
  protected async tryFetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    if (request.mode === "exactOutputQuote") {
      throw new QuoteError("0x aggregator does not support exact output quotes");
    }

    const response = await this.makeRequest(request as ExactInSwapParams);

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
      },
      route: zeroXRouteGraph(response),
    };
  }

  private async makeRequest(request: ExactInSwapParams): Promise<ZeroXQuoteResponse> {
    if (!this.config.apiKey) {
      throw new Error("0x API key is not set. Please set the ZEROX_API_KEY environment variable.");
    }

    const params = new URLSearchParams({
      chainId: request.chainId.toString(),
      buyToken: request.outputToken,
      sellToken: request.inputToken,
      sellAmount: request.inputAmount.toString(),
      slippageBps: request.slippageBps.toString(),
      taker: request.swapperAccount,
    });

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
