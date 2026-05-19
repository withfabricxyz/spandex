import { type Address, type Hex, zeroAddress } from "viem";
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

const O1_DOCS_URL = "https://docs.o1.exchange/api/dex-aggregator";
const DEFAULT_SUPPORTED_CHAINS = [8453];

/**
 * Configuration options for the o1 aggregator.
 */
export type O1Config = ProviderConfig & {
  /**
   * Base URL for the o1 API.
   */
  baseUrl: string;
  /**
   * API key sent as the `x-api-key` header.
   */
  apiKey: string;
  /**
   * Chain IDs this o1 deployment should be queried for.
   * Defaults to Base (8453), matching the public o1 DEX Aggregator API.
   */
  supportedChains?: number[];
};

/**
 * Aggregator implementation for the o1 DEX aggregator API.
 *
 * o1 exposes `POST /execute` as a one-shot quote and transaction assembly
 * endpoint. spanDEX uses that endpoint because provider quotes must include
 * executable calldata.
 *
 * @see https://docs.o1.exchange/api/dex-aggregator
 */
export class O1Aggregator extends Aggregator<O1Config> {
  /**
   * @inheritdoc
   */
  override metadata(): AggregatorMetadata {
    return {
      name: "o1",
      url: "https://o1.exchange",
      docsUrl: O1_DOCS_URL,
    };
  }

  /**
   * @inheritdoc
   */
  override name(): ProviderKey {
    return "o1";
  }

  /**
   * o1 accepts either the zero address or the EIP-7528 sentinel for native
   * tokens. spanDEX normalizes native assets to the zero address.
   */
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
   * @inheritdoc
   */
  protected override async tryFetchQuote(
    request: SwapParams,
    options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    if (request.mode === "targetOut") {
      throw new QuoteError("o1 aggregator does not support exact output quotes");
    }

    if ((request.outputChainId ?? request.chainId) !== request.chainId) {
      throw new QuoteError("o1 aggregator does not support cross-chain quotes");
    }

    if (!this.supportedChains().includes(request.chainId)) {
      throw new QuoteError(`o1 aggregator does not support chain ${request.chainId}`);
    }

    const recipient = request.recipientAccount ?? request.swapperAccount;
    if (recipient.toLowerCase() !== request.swapperAccount.toLowerCase()) {
      throw new QuoteError("o1 aggregator does not support separate recipient accounts");
    }

    const response = await this.execute(request as ExactInSwapParams, options);
    const inputAmount = parseBigInt(response.routePlan.amountIn) ?? request.inputAmount;
    const outputAmount = parseBigInt(response.routePlan.expectedAmountOut) ?? 0n;
    const networkFee = parseBigInt(response.routePlan.gasEstimate?.gasCostWei) ?? 0n;
    const txValue = parseBigInt(response.value) ?? 0n;
    const gas = gasLimit(response.routePlan.gasEstimate?.gasUnits);

    return {
      success: true,
      provider: "o1",
      details: response,
      latency: 0,
      inputChainId: request.chainId,
      outputChainId: request.chainId,
      execution: "atomic",
      inputAmount,
      outputAmount,
      networkFee,
      txData: {
        to: response.to,
        data: response.data,
        ...(txValue > 0n ? { value: txValue } : {}),
        ...(gas !== undefined ? { gas } : {}),
      },
      approval: !isNativeToken(request.inputToken)
        ? {
            token: request.inputToken,
            spender: response.to,
          }
        : undefined,
      route: o1RouteGraph(response),
      pricing: buildO1Pricing(request as ExactInSwapParams),
    };
  }

  private async execute(
    request: ExactInSwapParams,
    options: SwapOptions,
  ): Promise<O1QuoteResponse> {
    if (!this.config.baseUrl) {
      throw new Error(
        "o1 API base URL is not set. Please set the O1_BASE_URL environment variable.",
      );
    }
    if (!this.config.apiKey) {
      throw new Error("o1 API key is not set. Please set the O1_API_KEY environment variable.");
    }

    const response = await fetch(`${this.baseUrl()}/execute`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify(extractBodyParams(request, options, this.supportsFeature.bind(this))),
    });

    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new QuoteError(`o1 API request failed with status ${response.status}`, body);
    }

    return body as O1QuoteResponse;
  }

  private baseUrl() {
    return this.config.baseUrl.replace(/\/$/, "");
  }

  private supportedChains(): number[] {
    return this.config.supportedChains ?? DEFAULT_SUPPORTED_CHAINS;
  }
}

/**
 * Convenience factory for creating an o1 aggregator instance.
 *
 * @param config - o1 configuration.
 * @returns O1Aggregator instance.
 */
export function o1(config: O1Config): O1Aggregator {
  return new O1Aggregator(config);
}

function extractBodyParams(
  params: ExactInSwapParams,
  options: SwapOptions,
  supportsFeature: (feature: AggregatorFeature) => boolean,
): O1ExecuteRequest {
  const body: O1ExecuteRequest = {
    chainId: params.chainId,
    tokenIn: params.inputToken,
    tokenOut: params.outputToken,
    amountIn: params.inputAmount.toString(),
    slippageBps: params.slippageBps,
    user: params.swapperAccount,
    useNativeIn: isNativeToken(params.inputToken),
    unwrapNativeOut: isNativeToken(params.outputToken),
  };

  if (options.integratorSwapFeeBps !== undefined && supportsFeature("integratorFees")) {
    body.feeBps = options.integratorSwapFeeBps;
  }

  return body;
}

export function o1RouteGraph(response: O1QuoteResponse): RouteGraph {
  const nodeMap = new Map<string, TokenNode>();
  const setNode = (address: Address) => {
    nodeMap.set(address.toLowerCase(), { address });
  };

  setNode(response.routePlan.tokenIn);
  setNode(response.routePlan.tokenOut);

  const edges: PoolEdge[] = [];
  for (const [routeIndex, route] of response.routePlan.routes.entries()) {
    for (const [legIndex, leg] of route.legs.entries()) {
      setNode(leg.tokenIn);
      setNode(leg.tokenOut);
      edges.push({
        source: leg.tokenIn,
        target: leg.tokenOut,
        address: legAddress(leg),
        key: leg.poolId ?? `${leg.dex}-${routeIndex}-${legIndex}`,
        value: Number(leg.amountIn),
      });
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
  };
}

function legAddress(leg: O1RouteLeg): Address | undefined {
  const data = leg.data;
  if (isAddressLike(data?.pool)) {
    return data.pool;
  }
  if (isAddressLike(data?.router)) {
    return data.router;
  }
  return undefined;
}

function isAddressLike(value: unknown): value is Address {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function buildO1Pricing(request: ExactInSwapParams): {
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

function gasLimit(gasUnits?: number): bigint | undefined {
  if (!Number.isFinite(gasUnits)) {
    return undefined;
  }
  return BigInt(Math.trunc(gasUnits as number));
}

type O1ExecuteRequest = {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  slippageBps: number;
  user: Address;
  feeBps?: number;
  useNativeIn: boolean;
  unwrapNativeOut: boolean;
};

type O1LegData = {
  pool?: Address;
  router?: Address;
  [key: string]: unknown;
};

export type O1QuoteResponse = {
  quoteId: string;
  chainId: number;
  to: Address;
  data: Hex;
  value: string;
  routePlan: {
    chainId: number;
    tokenIn: Address;
    tokenOut: Address;
    amountIn: string;
    expectedAmountOut: string;
    minAmountOut: string;
    feeBps?: number;
    slippageBps: number;
    routes: O1SplitRoute[];
    blockNumber: number;
    gasEstimate?: {
      gasUnits?: number;
      gasCostWei?: string;
    };
    nativeIn?: boolean;
    nativeOut?: boolean;
    providerCalldata?: {
      source: string;
      to: Address;
      data: Hex;
      value: string;
      gas?: number;
    };
  };
  expiresAt: number;
  provider?: string;
  simWarning?: string;
};

type O1SplitRoute = {
  amountIn: string;
  legs: O1RouteLeg[];
};

type O1RouteLeg = {
  dex: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: string;
  minOut: string;
  poolId?: string;
  data?: O1LegData;
};
