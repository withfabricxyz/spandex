import { Aggregator } from "../aggregator.js";
import {
  type Address,
  type PoolEdge,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapParams,
} from "../types.js";

const chainNameLookup: Record<number, string> = {
  8453: "base", // Base Mainnet
  1: "ethereum", // Ethereum Mainnet
  56: "bsc", // BNB Chain Mainnet
  137: "polygon", // Polygon Mainnet
  10: "optimism", // Optimism Mainnet
  42161: "arbitrum", // Arbitrum One
  43114: "avalanche", // Avalanche C-Chain
  324: "zksync", // zkSync Era Mainnet
  250: "fantom", // Fantom Opera
  59144: "linea", // Linea Mainnet
  534352: "scroll", // Scroll Mainnet
  5000: "mantle", // Mantle Mainnet
  81457: "blast", // Blast Mainnet
  146: "sonic", // Sonic Mainnet
  80094: "berachain", // Berachain Mainnet
  2020: "ronin", // Ronin Mainnet
  999: "hyperevm", // HyperEVM Mainnet
};

export type KyberConfig = {
  clientId: string;
};

/**
 * Aggregator implementation for the KyberSwap routing API.
 */
export class KyberAggregator extends Aggregator {
  /**
   * @param config - Kyber-specific configuration, defaulting to the `smal` client id.
   */
  constructor(private config: KyberConfig = { clientId: "smal" }) {
    super();
  }

  /**
   * @inheritdoc
   */
  name(): ProviderKey {
    return "kyberswap";
  }

  /**
   * @inheritdoc
   */
  protected async tryFetchQuote(request: SwapParams): Promise<SuccessfulQuote> {
    const response = await this.getRoute(request);
    const networkFee =
      BigInt(response.totalGas) * BigInt(Math.round(Number(response.gasPriceGwei) * 10 ** 9));
    return {
      success: true,
      provider: "kyberswap",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      outputAmount: BigInt(response.outputAmount),
      networkFee,
      txData: {
        to: response.routerAddress,
        data: response.encodedSwapData,
      },
      route: kyberRouteGraph(response),
    };
  }

  private async getRoute(query: SwapParams): Promise<KyberQuoteResponse> {
    const chain = chainNameLookup[query.chainId];
    const params = new URLSearchParams({
      tokenOut: query.outputToken,
      tokenIn: query.inputToken,
      amountIn: query.inputAmount.toString(),
      slippageTolerance: query.slippageBps.toString(),
      to: query.swapperAccount,
    });

    const output = await fetch(
      `https://aggregator-api.kyberswap.com/${chain}/route/encode?${params.toString()}`,
      {
        headers: {
          accept: "application/json",
          "X-Client-Id": this.config.clientId,
        },
      },
    ).then(async (response) => {
      const body = await response.json();
      if (!response.ok) {
        throw new QuoteError(`Kyber API request failed with status ${response.status}`, body);
      }
      return body;
    });

    return output as KyberQuoteResponse;
  }
}

export function kyberRouteGraph(response: KyberQuoteResponse): RouteGraph {
  const nodes = Object.entries(response.tokens).map(([address, detail]) => ({
    address: address as Address,
    symbol: detail.symbol,
    decimals: detail.decimals,
  }));

  const edges: PoolEdge[] = [];
  for (const swap of response.swaps) {
    for (const leg of swap) {
      edges.push({
        source: leg.tokenIn,
        target: leg.tokenOut,
        address: leg.pool,
        key: leg.pool,
        value: Number(leg.swapAmount),
      });
    }
  }

  return {
    nodes,
    edges,
  };
}

//////// Types /////////
// Extracted from 0x API documentation with GPT5
////////////////////////

interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  price: number; // USD price
  decimals: number;
}

/**
 * One hop/leg within a path.
 */
interface SwapLeg {
  pool: Address;
  tokenIn: Address;
  tokenOut: Address;
  swapAmount: string; // amount of tokenIn sent to this pool
  amountOut: string; // amount of tokenOut from this leg
  exchange: string; // e.g. "uniswapv3"
  poolType: string; // e.g. "univ3"
}

/**
 * A path is an ordered list of legs. `swaps` is an array of paths.
 */
type SwapPath = SwapLeg[];

// ---------- Main response type ----------

/**
 * Legacy Get Swap Info with Encoded Data
 * GET https://aggregator-api.kyberswap.com/{chain}/route/encode
 */
export interface KyberQuoteResponse {
  /**
   * Input amount in tokenIn base units (wei).
   */
  inputAmount: string;

  /**
   * Output amount in tokenOut base units (wei).
   */
  outputAmount: string;

  /**
   * Total estimated gas units.
   */
  totalGas: number;

  /**
   * Gas price in Gwei, as a decimal string.
   */
  gasPriceGwei: string;

  /**
   * Estimated gas cost in USD.
   */
  gasUsd: number;

  /**
   * Value of inputAmount in USD.
   */
  amountInUsd: number;

  /**
   * Value of outputAmount in USD.
   */
  amountOutUsd: number;

  /**
   * Effective received USD after fees/slippage.
   */
  receivedUsd: number;

  /**
   * All candidate swap paths.
   * Each element is a path, which is a sequence of pool hops.
   */
  swaps: SwapPath[];

  /**
   * Token metadata keyed by token address.
   */
  tokens: Record<Address, TokenInfo>;

  /**
   * Calldata to send to the KyberSwap router contract.
   */
  encodedSwapData: `0x${string}`;

  /**
   * KyberSwap router contract address for this swap.
   */
  routerAddress: Address;
}
