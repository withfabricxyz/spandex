import { type Address, zeroAddress } from "viem";
import {
  type AggregatorFeature,
  type AggregatorMetadata,
  type PoolEdge,
  type ProviderConfig,
  type ProviderKey,
  QuoteError,
  type QuoteMetrics,
  type RouteGraph,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
  type TokenNode,
  type TokenPricing,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { computeUsdPriceFromValue } from "../util/pricing.js";
import { Aggregator } from "./index.js";

const DEFAULT_BASE_URL = "https://api.paraswap.io";
const LATEST_VERSION = "6.2";
const VELORA_NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * Configuration options for the Velora aggregator.
 */
export type VeloraConfig = ProviderConfig & {
  /**
   * Base URL for Velora's API.
   * Defaults to `https://api.paraswap.io`.
   */
  baseUrl?: string;
  /**
   * Optional partner slug used by Velora for attribution.
   * This maps to the `partner` query param on Velora's `/swap` endpoint.
   */
  partner?: string;
  /**
   * Toggle direct fee capture when fee capture is enabled
   */
  isDirectFeeTransfer?: boolean;
};

/**
 * Aggregator implementation for Velora's market API using the single-request `/swap` endpoint.
 */
export class VeloraAggregator extends Aggregator<VeloraConfig> {
  constructor(config: VeloraConfig = {}) {
    super(config);
  }

  override metadata(): AggregatorMetadata {
    return {
      name: "Velora",
      url: "https://velora.xyz",
      docsUrl:
        "https://developers.velora.xyz/api/velora-api/velora-market-api/get-rate-for-a-token-pair-1",
      logoUrl: "https://velora.xyz/favicon.ico",
    };
  }

  override name(): ProviderKey {
    return "velora";
  }

  override features(): AggregatorFeature[] {
    return ["exactIn", "targetOut", "integratorFees", "integratorSurplus"];
  }

  protected override async tryFetchQuote(
    request: SwapParams,
    options: SwapOptions,
  ): Promise<SuccessfulQuote> {
    const response = await this.getSwapQuote(request, options);
    const priceRoute = response.priceRoute;
    const tx = response.txParams;

    const to = parseAddress(tx.to) ?? parseAddress(priceRoute.contractAddress);
    if (!to || !tx.data) {
      throw new QuoteError("Velora swap response missing transaction parameters", response);
    }

    const inputAmount =
      parseBigInt(priceRoute.srcAmount) ?? (request.mode === "exactIn" ? request.inputAmount : 0n);
    const outputAmount =
      parseBigInt(priceRoute.destAmount) ??
      (request.mode === "targetOut" ? request.outputAmount : 0n);

    const txValue = parseBigInt(tx.value) ?? 0n;
    const approvalSpender = parseAddress(priceRoute.tokenTransferProxy) ?? to;

    return {
      success: true,
      provider: "velora",
      details: response,
      latency: 0,
      inputAmount,
      outputAmount,
      networkFee: veloraNetworkFee(priceRoute, tx),
      txData: {
        to,
        data: tx.data,
        ...(txValue > 0n ? { value: txValue } : {}),
      },
      approval: !isNativeToken(request.inputToken)
        ? {
            token: request.inputToken,
            spender: approvalSpender,
          }
        : undefined,
      route: veloraRouteGraph(priceRoute),
      pricing: buildVeloraPricing(request, priceRoute),
      metrics: buildVeloraMetrics(priceRoute),
    };
  }

  private async getSwapQuote(
    request: SwapParams,
    options: SwapOptions,
  ): Promise<VeloraQuoteResponse> {
    const side: VeloraSide = request.mode === "exactIn" ? "SELL" : "BUY";
    const hasFeeRequest = (options.integratorSwapFeeBps ?? 0) > 0;
    const hasSurplusRequest = (options.integratorSurplusBps ?? 0) > 0;
    const partnerAddress = resolvePartnerAddress({
      hasFeeRequest,
      hasSurplusRequest,
      feeAddress: options.integratorFeeAddress,
      surplusAddress: options.integratorSurplusAddress,
    });

    const params = new URLSearchParams({
      srcToken: toVeloraToken(request.inputToken),
      destToken: toVeloraToken(request.outputToken),
      amount:
        request.mode === "exactIn"
          ? request.inputAmount.toString()
          : request.outputAmount.toString(),
      side,
      network: request.chainId.toString(),
      userAddress: request.swapperAccount,
      slippage: request.slippageBps.toString(),
      version: LATEST_VERSION,
    });

    if (request.recipientAccount) {
      params.set("receiver", request.recipientAccount);
    }
    if (this.config.partner) {
      params.set("partner", this.config.partner);
    }
    if (partnerAddress) {
      params.set("partnerAddress", partnerAddress);
      params.set("isDirectFeeTransfer", `${this.config.isDirectFeeTransfer || true}`);
    }
    if (options.integratorSwapFeeBps !== undefined) {
      params.set("partnerFeeBps", options.integratorSwapFeeBps.toString());
    }
    const surplusBps = options.integratorSurplusBps ?? 0;
    if (surplusBps > 0) {
      params.set("takeSurplus", "true");
    }

    const response = await fetch(`${this.baseUrl()}/swap?${params.toString()}`, {
      headers: {
        accept: "application/json",
      },
    });

    const body = (await response.json()) as VeloraQuoteResponse;
    if (!response.ok) {
      throw new QuoteError(`Velora swap request failed with status ${response.status}`, body);
    }
    if (!body.priceRoute || !body.txParams) {
      throw new QuoteError("Velora swap response missing required fields", body);
    }

    return body;
  }

  private baseUrl() {
    return (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }
}

/**
 * Convenience factory for creating a Velora aggregator instance.
 */
export function velora(config?: VeloraConfig): VeloraAggregator {
  return new VeloraAggregator(config);
}

function veloraRouteGraph(priceRoute: VeloraPriceRoute): RouteGraph {
  const nodes = collectNodes(priceRoute);
  const edges: PoolEdge[] = [];

  for (const [routeIndex, route] of (priceRoute.bestRoute ?? []).entries()) {
    for (const [swapIndex, swap] of (route.swaps ?? []).entries()) {
      for (const [exchangeIndex, exchange] of (swap.swapExchanges ?? []).entries()) {
        const source = fromVeloraToken(exchange.srcToken ?? swap.srcToken);
        const target = fromVeloraToken(exchange.destToken ?? swap.destToken);
        const value = parseFiniteNumber(exchange.srcAmount) ?? 0;
        const pools = exchange.poolAddresses ?? [];

        if (pools.length === 0) {
          edges.push({
            source,
            target,
            key: `${exchange.exchange}-${routeIndex}-${swapIndex}-${exchangeIndex}`,
            value,
          });
          continue;
        }

        for (const poolAddress of pools) {
          const pool = parseAddress(poolAddress);
          edges.push({
            source,
            target,
            key: pool ? `${exchange.exchange}-${pool}` : `${exchange.exchange}-${poolAddress}`,
            address: pool,
            value,
          });
        }
      }
    }
  }

  return { nodes, edges };
}

function collectNodes(priceRoute: VeloraPriceRoute): TokenNode[] {
  const nodeMap = new Map<string, TokenNode>();

  const setNode = (address: string | undefined, fields?: Partial<TokenNode>) => {
    const parsed = parseAddress(address);
    if (!parsed) return;
    nodeMap.set(parsed.toLowerCase(), {
      address: parsed,
      symbol: fields?.symbol,
      decimals: fields?.decimals,
      logoURI: fields?.logoURI,
    });
  };

  setNode(priceRoute.srcToken, {
    symbol: priceRoute.srcTokenSymbol,
    decimals: priceRoute.srcDecimals,
  });
  setNode(priceRoute.destToken, {
    symbol: priceRoute.destTokenSymbol,
    decimals: priceRoute.destDecimals,
  });

  for (const route of priceRoute.bestRoute ?? []) {
    for (const swap of route.swaps ?? []) {
      setNode(swap.srcToken);
      setNode(swap.destToken);
      for (const exchange of swap.swapExchanges ?? []) {
        setNode(exchange.srcToken);
        setNode(exchange.destToken);
      }
    }
  }

  return [...nodeMap.values()];
}

function buildVeloraPricing(
  request: SwapParams,
  priceRoute: VeloraPriceRoute,
): { inputToken: TokenPricing; outputToken: TokenPricing } {
  const inputAmount =
    request.mode === "exactIn" ? request.inputAmount : (parseBigInt(priceRoute.srcAmount) ?? 0n);
  const outputAmount =
    request.mode === "targetOut"
      ? request.outputAmount
      : (parseBigInt(priceRoute.destAmount) ?? 0n);

  return {
    inputToken: {
      address: request.inputToken,
      symbol: priceRoute.srcTokenSymbol,
      decimals: priceRoute.srcDecimals,
      usdPrice: computeUsdPriceFromValue(
        inputAmount,
        priceRoute.srcDecimals,
        parseFiniteNumber(priceRoute.srcUSD),
      ),
    },
    outputToken: {
      address: request.outputToken,
      symbol: priceRoute.destTokenSymbol,
      decimals: priceRoute.destDecimals,
      usdPrice: computeUsdPriceFromValue(
        outputAmount,
        priceRoute.destDecimals,
        parseFiniteNumber(priceRoute.destUSD),
      ),
    },
  };
}

function buildVeloraMetrics(priceRoute: VeloraPriceRoute): QuoteMetrics | undefined {
  const impact = parseFiniteNumber(priceRoute.priceImpact);
  if (impact === undefined) {
    return undefined;
  }
  return { priceImpactBps: Math.round(impact * 100) };
}

function veloraNetworkFee(priceRoute: VeloraPriceRoute, tx: VeloraTxParams): bigint {
  const gasUnits = parseBigInt(tx.gas) ?? parseBigInt(priceRoute.gasCost);
  const gasPrice = parseBigInt(tx.gasPrice) ?? parseBigInt(tx.maxFeePerGas);
  if (gasUnits !== undefined && gasPrice !== undefined) {
    return gasUnits * gasPrice;
  }
  return 0n;
}

function toVeloraToken(address: Address): Address {
  return isNativeToken(address) ? (VELORA_NATIVE_TOKEN as Address) : address;
}

function resolvePartnerAddress({
  hasFeeRequest,
  hasSurplusRequest,
  feeAddress,
  surplusAddress,
}: {
  hasFeeRequest: boolean;
  hasSurplusRequest: boolean;
  feeAddress?: Address;
  surplusAddress?: Address;
}): Address | undefined {
  // Velora exposes a single partner recipient (`partnerAddress`) for fee/surplus flows.
  // Prioritize fee recipient when swap fees are requested, otherwise prefer surplus recipient.
  if (hasFeeRequest) {
    return feeAddress;
  }
  if (hasSurplusRequest) {
    return surplusAddress ?? feeAddress;
  }
  return undefined;
}

function fromVeloraToken(address?: string): Address {
  if (!address || address.toLowerCase() === VELORA_NATIVE_TOKEN.toLowerCase()) {
    return zeroAddress;
  }
  return address as Address;
}

function parseAddress(value?: string): Address | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = fromVeloraToken(value);
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    return undefined;
  }
  return normalized;
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

function parseFiniteNumber(value?: string | number): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

//////// Types /////////
// Extracted from Velora API documentation
////////////////////////

type VeloraSide = "SELL" | "BUY";

type VeloraSwapExchange = {
  exchange: string;
  srcAmount?: string;
  destAmount?: string;
  srcToken?: Address;
  destToken?: Address;
  percent?: number;
  poolAddresses?: string[];
};

type VeloraSwap = {
  srcToken: Address;
  destToken: Address;
  swapExchanges: VeloraSwapExchange[];
};

type VeloraBestRoute = {
  percent: number;
  swaps: VeloraSwap[];
};

export type VeloraPriceRoute = {
  /**
   * Block used when the route was computed.
   */
  blockNumber: number;
  /**
   * Input token address in canonical EVM format.
   */
  srcToken: Address;
  /**
   * Input token decimals, if provided by the API.
   */
  srcDecimals?: number;
  /**
   * Input amount in base units as a decimal string.
   */
  srcAmount: string;
  /**
   * Input amount valuation in USD.
   */
  srcUSD?: string;
  /**
   * Input token symbol when available.
   */
  srcTokenSymbol?: string;
  /**
   * Output token address in canonical EVM format.
   */
  destToken: Address;
  /**
   * Output token decimals, if provided by the API.
   */
  destDecimals?: number;
  /**
   * Output amount in base units as a decimal string.
   */
  destAmount: string;
  /**
   * Output amount valuation in USD.
   */
  destUSD?: string;
  /**
   * Output token symbol when available.
   */
  destTokenSymbol?: string;
  /**
   * Spender that should receive ERC-20 approvals for swap execution.
   */
  tokenTransferProxy?: Address;
  /**
   * Router/entrypoint contract used for transaction execution.
   */
  contractAddress?: Address;
  /**
   * Estimated gas units as a decimal string.
   */
  gasCost?: string;
  /**
   * Price impact percentage (e.g. `0.42` = 0.42%).
   */
  priceImpact?: string | number;
  /**
   * Best route decomposition into hops and liquidity sources.
   */
  bestRoute?: VeloraBestRoute[];
  /**
   * Chain ID (EIP-155).
   */
  network: number;
  /*
   * Partner identifier
   */
  partner: string;
  /**
   * Partner Fee
   */
  partnerFee: number;
};

export type VeloraTxParams = {
  /**
   * Optional sender address associated with this quote payload.
   */
  from?: Address;
  /**
   * Destination router contract to call.
   */
  to: Address;
  /**
   * ETH value to send with the swap transaction (in wei, decimal string).
   */
  value?: string;
  /**
   * ABI-encoded calldata for the swap transaction.
   */
  data: `0x${string}`;
  /**
   * Legacy gas price in wei (decimal string), when provided.
   */
  gasPrice?: string;
  /**
   * Estimated gas units (decimal string), when provided.
   */
  gas?: string;
  /**
   * EIP-1559 max fee per gas in wei (decimal string), when provided.
   */
  maxFeePerGas?: string;
  /**
   * EIP-1559 priority fee per gas in wei (decimal string), when provided.
   */
  maxPriorityFeePerGas?: string;
  /**
   * Chain ID (EIP-155) associated with the transaction.
   */
  chainId?: number;
};

export type VeloraQuoteResponse = {
  /**
   * Route, pricing, and path metadata returned by Velora.
   */
  priceRoute: VeloraPriceRoute;
  /**
   * Transaction payload that can be submitted to execute the swap.
   */
  txParams: VeloraTxParams;
};
