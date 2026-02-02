import { type Address, zeroAddress } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type ExactInSwapParams,
  type PoolEdge,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenPricing,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { Aggregator } from "./index.js";

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

const KYBER_NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * Configuration options for the KyberSwap aggregator.
 */
export type KyberConfig = ProviderConfig & {
  /**
   * Client ID for accessing the KyberSwap API. You can make it up.
   */
  clientId: string;
};

/**
 * Aggregator implementation for the KyberSwap routing API.
 */
export class KyberAggregator extends Aggregator<KyberConfig> {
  /**
   * @param config - Kyber-specific configuration, defaulting to the `spandex` client id.
   */
  constructor(config: KyberConfig = { clientId: "spandex" }) {
    super(config);
  }

  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "KyberSwap",
      url: "https://kyber.network",
      docsUrl:
        "https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps#get-chain-route-encode",
      logoUrl: "https://kyberswap.com/favicon.png",
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "kyberswap";
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
      throw new QuoteError("KyberSwap aggregator does not support exact output quotes");
    }

    const response = await this.getRoute(request as ExactInSwapParams, options);
    const pricing = buildKyberPricing(request as ExactInSwapParams, response);
    const networkFee =
      BigInt(response.totalGas) * BigInt(Math.round(Number(response.gasPriceGwei) * 10 ** 9));
    return {
      success: true,
      provider: "kyberswap",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      outputAmount: BigInt(response.outputAmount),
      inputAmount: BigInt(response.inputAmount),
      networkFee,
      txData: {
        to: response.routerAddress,
        data: response.encodedSwapData,
        ...(isNativeToken(request.inputToken) ? { value: request.inputAmount } : {}),
      },
      approval: !isNativeToken(request.inputToken)
        ? {
            token: request.inputToken,
            spender: response.routerAddress,
          }
        : undefined,
      route: kyberRouteGraph(response),
      pricing,
    };
  }

  private async getRoute(
    query: ExactInSwapParams,
    options: SwapOptions,
  ): Promise<KyberQuoteResponse> {
    const chain = chainNameLookup[query.chainId];
    const params = new URLSearchParams(extractQueryParams(query, options));

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

/**
 * Convenience factory for creating a KyberSwap aggregator instance.
 *
 * @param config - Optional KyberSwap configuration.
 * @returns KyberAggregator instance.
 */
export function kyberswap(config?: KyberConfig): KyberAggregator {
  return new KyberAggregator(config);
}

function extractQueryParams(
  params: ExactInSwapParams,
  options: SwapOptions,
): Record<string, string> {
  const result: Record<string, string> = {
    tokenOut: toKyberToken(params.outputToken),
    tokenIn: toKyberToken(params.inputToken),
    amountIn: params.inputAmount.toString(),
    slippageTolerance: params.slippageBps.toString(),
    to: params.swapperAccount,
  };

  if (options.integratorFeeAddress) {
    result.feeReceiver = options.integratorFeeAddress;
    result.isInBps = "true";
    result.chargeFeeBy = "currency_out"; // TODO: make configurable
    if (options.integratorSwapFeeBps !== undefined) {
      result.feeAmount = options.integratorSwapFeeBps.toString();
    }
  }

  return result;
}

export function kyberRouteGraph(response: KyberQuoteResponse): RouteGraph {
  const nodes = Object.entries(response.tokens).map(([address, detail]) => ({
    address: fromKyberToken(address as Address),
    symbol: detail.symbol,
    decimals: detail.decimals,
  }));

  const edges: PoolEdge[] = [];
  for (const swap of response.swaps) {
    for (const leg of swap) {
      edges.push({
        source: fromKyberToken(leg.tokenIn),
        target: fromKyberToken(leg.tokenOut),
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

function buildKyberPricing(
  request: ExactInSwapParams,
  response: KyberQuoteResponse,
): { inputToken: TokenPricing; outputToken: TokenPricing } {
  const inputTokenInfo = resolveTokenInfo(response.tokens, toKyberToken(request.inputToken));
  const outputTokenInfo = resolveTokenInfo(response.tokens, toKyberToken(request.outputToken));

  return {
    inputToken: {
      address: request.inputToken,
      symbol: inputTokenInfo?.symbol,
      decimals: inputTokenInfo?.decimals,
      usdPrice: inputTokenInfo?.price,
    },
    outputToken: {
      address: request.outputToken,
      symbol: outputTokenInfo?.symbol,
      decimals: outputTokenInfo?.decimals,
      usdPrice: outputTokenInfo?.price,
    },
  };
}

function resolveTokenInfo(tokens: KyberQuoteResponse["tokens"], address: Address) {
  return (
    tokens[address as Address] ||
    Object.values(tokens).find((token) => token.address.toLowerCase() === address.toLowerCase())
  );
}

function toKyberToken(address: Address): Address {
  return isNativeToken(address) ? (KYBER_NATIVE_TOKEN as Address) : address;
}

function fromKyberToken(address: Address): Address {
  return address.toLowerCase() === KYBER_NATIVE_TOKEN.toLowerCase() ? zeroAddress : address;
}

//////// Types /////////
// Extracted from Kyber API documentation with GPT5
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
