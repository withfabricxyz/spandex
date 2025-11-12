import type { Hex } from "viem";
import { Aggregator } from "../aggregator.js";
import {
  type Address,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapParams,
} from "../types.js";

const FABRIC_BASE_URL = process.env.FABRIC_BASE_URL || "http://booda.defi.withfabric.xyz";

export type FabricQuoteResponse = {
  blockNumber: number;
  amountIn: string;
  amountOut: string;
  price: number;
  description: string;
  tokens: TokenData[];
  route: Route;
  approval?: {
    token: Address;
    amount: string;
    spender: Address;
  };
  transaction: {
    to: Address;
    data: `0x${string}`;
    value: string;
  };
  fees: Fee[];
  id: string;
};

type Fee = {
  recipient: Address;
  token: Address;
  amount: string;
};

type TokenData = {
  symbol: string;
  decimals: number;
  address: Address;
  priceUsd?: number;
};

type Swap = {
  key: Hex;
  address: Address;
  protocol: string;
  fork: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  amountOut: string;
};

type Route = {
  swaps: Swap[][];
  amountIn: string;
  amountOut: string;
};

export type FabricConfig = {
  url?: string;
  apiKey?: string;
};

export class FabricAggregator extends Aggregator {
  constructor(private config: FabricConfig = { url: FABRIC_BASE_URL }) {
    super();
  }

  name(): ProviderKey {
    return "fabric";
  }

  protected async tryFetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    const response = await this.makeRequest(request);
    const amountOut = response.amountOut;

    return {
      success: true,
      provider: "fabric",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      outputAmount: BigInt(amountOut),
      networkFee: 0n, // TODO
      // blockNumber: response.blockNumber,
      txData: {
        to: response.transaction.to,
        data: response.transaction.data,
        value: BigInt(response.transaction.value),
      },
      route: fabricRouteGraph(response),
    };
  }

  private async makeRequest(params: SwapParams): Promise<FabricQuoteResponse> {
    const query = new URLSearchParams({
      chainId: params.chainId.toString(),
      buyToken: params.outputToken,
      sellToken: params.inputToken,
      sellAmount: params.inputAmount.toString(),
      slippageBps: params.slippageBps.toString(),
    });

    return await fetch(`${this.config.url}/v1/quote?${query.toString()}`, {
      headers: {
        accept: "application/json",
      },
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) {
        throw new QuoteError(`Fabric API request failed with status ${response.status}`, body);
      }
      return body as FabricQuoteResponse;
    });
  }
}

export function fabricRouteGraph(quote: FabricQuoteResponse): RouteGraph {
  const swaps = quote.route.swaps.flat();
  const nodes = quote.tokens;
  const edges = swaps.map((swap) => ({
    source: swap.tokenIn,
    target: swap.tokenOut,
    address: swap.address,
    key: swap.key,
    value: Number(swap.amountIn),
  }));

  return {
    nodes,
    edges,
  };
}
