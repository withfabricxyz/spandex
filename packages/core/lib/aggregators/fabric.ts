import type { Hex } from "viem";
import { Aggregator } from "../aggregator";
import {
  type Address,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapParams,
} from "../types";

const FABRIC_BASE_URL = process.env.FABRIC_BASE_URL || "http://booda.defi.withfabric.xyz";

type FabricQuoteRequest = {
  chainId: number;
  sellToken: Address;
  buyToken: Address;
  sellAmount?: string;
  buyAmount?: string;
  feeBps?: number;
  feeRecipient?: Address;
  slippageBps?: number;
  receiver?: Address;
};

export type FabricQuoteResponse = {
  blockNumber: number;
  amount: string;
  price: number;
  description: string;
  tokens: Record<string, any>;
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
};

type Swap = {
  key: Hex;
  address: Address;
  protocol: string;
  fork: string;
  tokenIn: Address;
  tokenOut: Address;
  inputPrice: number;
  outputPrice: number;
  amountIn: string;
  amountOut: string;
};

type Route = {
  swaps: Swap[][];
};

export type FabricConfig = {
  url?: string;
};

export class FabricAggregator extends Aggregator {
  constructor(private config: FabricConfig = { url: FABRIC_BASE_URL }) {
    super();
  }

  name(): ProviderKey {
    return "fabric";
  }

  async fetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    const response = await this.makeRequest(request);
    const amountOut = response.amount;
    const to = "0xaf79c73c73a5411f372864b50f56eeedf8a29aab"; // Temporary until deployed

    return {
      success: true,
      provider: "fabric",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      outputAmount: BigInt(amountOut),
      networkFee: 0n, // TODO
      // blockNumber: response.blockNumber,
      txData: {
        to,
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

  const nodes = Object.entries(quote.tokens).map(([address, token]) => ({
    address: address as Address,
    symbol: token.symbol,
    decimals: token.decimals,
  }));

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
