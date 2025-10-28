import { Aggregator } from "../aggregator";
import {
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapParams,
} from "../types";

export type ZeroXConfig = {
  apiKey: string;
};

export type ZeroXQuoteResponse = {
  buyAmount: string;
};

export class ZeroXAggregator extends Aggregator {
  constructor(private config: ZeroXConfig) {
    super();
  }

  name(): ProviderKey {
    return "0x";
  }

  async fetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    const response = await this.makeRequest(request);

    return {
      success: true,
      provider: "fabric",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      outputAmount: BigInt(response.buyAmount),
      networkFee: BigInt(response.totalNetworkFee), // TODO
      // blockNumber: response.blockNumber,
      txData: {
        to: response.transaction.to,
        data: response.transaction.data,
      },
      route: zeroXRouteGraph(response),
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private async makeRequest(request: SwapParams): Promise<any> {
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
    return body;
  }
}

function zeroXRouteGraph(_quote: ZeroXQuoteResponse): RouteGraph {
  return {
    nodes: [],
    edges: [],
  };
  // const route = quote.route;

  // const nodes = Object.entries(quote.tokens).map(([address, token]) => ({
  //   address: address as Address,
  //   symbol: token.symbol,
  //   decimals: token.decimals,
  // }));

  // // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  // const edges = (route as any[]).map((hop) => ({
  //   source: hop.token_in,
  //   target: hop.token_out,
  //   address: hop.pool,
  //   key: hop.pool,
  //   value: Number(hop.amount_in),
  // }));

  // return {
  //   nodes,
  //   edges,
  // };
}
