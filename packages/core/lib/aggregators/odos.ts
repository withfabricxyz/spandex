import { Aggregator } from "../aggregator.js";
import {
  type PoolEdge,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapParams,
} from "../types.js";

export type OdosConfig = {
  referralCode?: number;
};

export type OdosQuoteResponse = {
  pathId: string;
  inTokens: string[];
  outTokens: string[];
  inAmounts: string[];
  outAmounts: string[];
  gasEstimate: number;
  dataGasEstimate: number;
  gweiPerGas: number;
  gasEstimateValue: number;
  inValues: number[];
  outValues: number[];
  netOutValue: number;
  priceImpact: number;
  percentDiff: number;
  partnerFeePercent: number;
  pathViz?: {
    nodes: Array<{
      address: string;
      symbol?: string;
      decimals?: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      pool: string;
      value: string;
    }>;
  };
};

/**
 * Aggregator implementation for the Odos routing API.
 */
export class OdosAggregator extends Aggregator {
  /**
   * @param config - Optional Odos-specific configuration such as referral codes.
   */
  constructor(private readonly config: OdosConfig = {}) {
    super();
  }

  /**
   * @inheritdoc
   */
  name(): ProviderKey {
    return "odos";
  }

  /**
   * @inheritdoc
   *
   * Odos requires generating a quote to obtain a `pathId`, then assembling the transaction.
   */
  protected async tryFetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    const response = await this.getQuote(request);
    // TODO: is this right? copied from kyber
    const networkFee =
      BigInt(response.gasEstimate) * BigInt(Math.round(response.gweiPerGas * 10 ** 9));

    const txData = await assembleOdosTx(response.pathId, request.swapperAccount);
    const outputAmount = BigInt(response.outAmounts[0] || "0");
    const route = response.pathViz ? odosRouteGraph(response.pathViz) : undefined;

    return {
      success: true,
      provider: "odos",
      details: response,
      latency: 0,
      outputAmount,
      networkFee,
      txData,
      route,
    };
  }

  private async getQuote({
    chainId,
    inputToken,
    outputToken,
    inputAmount,
    slippageBps,
    swapperAccount,
  }: SwapParams): Promise<OdosQuoteResponse> {
    const quoteGenParams = {
      chainId: chainId,
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

    const response = await fetch("https://api.odos.xyz/sor/quote/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(quoteGenParams),
    });

    if (!response.ok) {
      const body = await response.json();
      throw new QuoteError(`Odos API request failed with status ${response.status}`, body);
    }

    return response.json() as Promise<OdosQuoteResponse>;
  }
}

async function assembleOdosTx(
  pathId: string,
  userAddr: string,
): Promise<{ to: `0x${string}`; data: `0x${string}`; value: bigint }> {
  const requestBody = {
    userAddr,
    pathId,
    simulate: false,
  };

  const response = await fetch("https://api.odos.xyz/sor/assemble", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new QuoteError(`Odos tx assembly request failed with status ${response.status}`, body);
  }

  const data = (await response.json()) as {
    transaction: {
      to: `0x${string}`;
      data: `0x${string}`;
      value: string;
    };
  };

  return {
    to: data.transaction.to,
    data: data.transaction.data,
    value: BigInt(data.transaction.value || 0),
  };
}

export function odosRouteGraph(pathViz: OdosQuoteResponse["pathViz"]): RouteGraph {
  if (!pathViz || !pathViz.nodes || !pathViz.edges) {
    return { nodes: [], edges: [] };
  }

  const nodes = pathViz.nodes.map((node) => ({
    address: node.address as `0x${string}`,
    symbol: node.symbol,
    decimals: node.decimals,
  }));

  const edges: PoolEdge[] = pathViz.edges.map((edge) => ({
    source: edge.source as `0x${string}`,
    target: edge.target as `0x${string}`,
    address: edge.pool as `0x${string}`,
    key: edge.pool,
    value: Number(edge.value),
  }));

  return {
    nodes,
    edges,
  };
}
