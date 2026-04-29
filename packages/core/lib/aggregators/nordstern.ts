import type { Address } from "viem";
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
  type TokenNode,
  type TokenPricing,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { Aggregator } from "./index.js";

const DEFAULT_BASE_URL = "https://api.nordstern.finance";
const NORDSTERN_REFERER = "https://spandex.sh";
const NORDSTERN_NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * Configuration options for the Nordstern aggregator.
 */
export type NordsternConfig = ProviderConfig & {
  /**
   * Base URL for the Nordstern API.
   * Defaults to `https://api.nordstern.finance`.
   */
  baseUrl?: string;
};

/**
 * Aggregator implementation for the Nordstern routing API.
 *
 * Nordstern exposes a single REST endpoint that returns the optimal swap route
 * between two tokens on any supported EVM chain along with executable calldata
 * for the Nordstern router contract.
 *
 * @see https://docs.nordstern.finance
 */
export class NordsternAggregator extends Aggregator<NordsternConfig> {
  /**
   * @param config - Optional Nordstern-specific configuration.
   */
  constructor(config: NordsternConfig = {}) {
    super(config);
  }

  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "Nordstern",
      url: "https://nordstern.finance",
      docsUrl: "https://docs.nordstern.finance",
      logoUrl: "https://spandex.sh/nordstern.png",
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "nordstern";
  }

  /**
   * Nordstern accepts either the zero address or the canonical
   * `0xEeeeeE...EEeE` sentinel for the native asset; we forward the latter
   * so it's unambiguous on the wire.
   */
  override nativeTokenAddress(): Address {
    return NORDSTERN_NATIVE_TOKEN as Address;
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
      throw new QuoteError("Nordstern aggregator does not support exact output quotes");
    }

    const response = await this.getQuote(request as ExactInSwapParams, options);

    const inputAmount = BigInt(response.fromAmount);
    const outputAmount = BigInt(response.toAmount);
    const txValue = parseBigInt(response.tx.value) ?? 0n;

    return {
      success: true,
      provider: "nordstern",
      details: response,
      latency: 0, // Filled in by MetaAggregator
      inputChainId: request.chainId,
      outputChainId: request.chainId,
      execution: "atomic",
      inputAmount,
      outputAmount,
      networkFee: 0n,
      txData: {
        to: response.tx.to,
        data: response.tx.data,
        ...(txValue > 0n ? { value: txValue } : {}),
      },
      approval: !isNativeToken(request.inputToken)
        ? {
            token: request.inputToken,
            spender: response.tx.to,
          }
        : undefined,
      route: nordsternRouteGraph(response),
      pricing: buildNordsternPricing(request as ExactInSwapParams),
    };
  }

  private async getQuote(
    request: ExactInSwapParams,
    options: SwapOptions,
  ): Promise<NordsternQuoteResponse> {
    const params = new URLSearchParams(extractQueryParams(request, options));

    const response = await fetch(
      `${this.baseUrl()}/aggregator/${request.chainId}?${params.toString()}`,
      {
        headers: {
          accept: "application/json",
          Referer: NORDSTERN_REFERER,
        },
      },
    );

    const body = await response.json();
    if (!response.ok) {
      throw new QuoteError(`Nordstern API request failed with status ${response.status}`, body);
    }

    return body as NordsternQuoteResponse;
  }

  private baseUrl() {
    return (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }
}

/**
 * Convenience factory for creating a Nordstern aggregator instance.
 *
 * @param config - Optional Nordstern configuration.
 * @returns NordsternAggregator instance.
 */
export function nordstern(config?: NordsternConfig): NordsternAggregator {
  return new NordsternAggregator(config);
}

function extractQueryParams(
  params: ExactInSwapParams,
  options: SwapOptions,
): Record<string, string> {
  const result: Record<string, string> = {
    src: params.inputToken,
    dst: params.outputToken,
    amount: params.inputAmount.toString(),
    from: params.recipientAccount ?? params.swapperAccount,
    // Nordstern expects slippage as a percentage (e.g. 0.5 = 0.5%).
    slippage: (params.slippageBps / 100).toString(),
  };

  if (options.integratorFeeAddress && options.integratorSwapFeeBps !== undefined) {
    result.convenienceFee = (options.integratorSwapFeeBps / 100).toString();
    result.convenienceFeeRecipient = options.integratorFeeAddress;
  }

  return result;
}

export function nordsternRouteGraph(response: NordsternQuoteResponse): RouteGraph {
  const nodeMap = new Map<string, TokenNode>();
  const setNode = (address: Address) => {
    nodeMap.set(address.toLowerCase(), { address });
  };

  setNode(response.src);
  setNode(response.dst);

  const edges: PoolEdge[] = [];
  for (const [swapIndex, swap] of (response.swaps ?? []).entries()) {
    for (const [legIndex, leg] of (swap.route ?? []).entries()) {
      setNode(leg.tokenIn);
      setNode(leg.tokenOut);
      edges.push({
        source: leg.tokenIn,
        target: leg.tokenOut,
        address: leg.pool,
        key: `${leg.pool}-${swapIndex}-${legIndex}`,
        value: Number(swap.amountIn),
      });
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
  };
}

function buildNordsternPricing(request: ExactInSwapParams): {
  inputToken: TokenPricing;
  outputToken: TokenPricing;
} {
  return {
    inputToken: { address: request.inputToken },
    outputToken: { address: request.outputToken },
  };
}

function parseBigInt(value?: string | number | bigint): bigint | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

/** Fields read from Nordstern `GET /aggregator/{chainId}` JSON responses. */
export type NordsternQuoteResponse = {
  src: Address;
  dst: Address;
  fromAmount: string;
  toAmount: string;
  swaps: Array<{
    amountIn: string | number;
    route: Array<{ pool: Address; tokenIn: Address; tokenOut: Address }>;
  }>;
  tx: {
    to: Address;
    data: `0x${string}`;
    value: string;
  };
};
