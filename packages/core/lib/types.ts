import type { KyberConfig, KyberQuoteResponse } from "./aggregators/kyber";
import type { ZeroXConfig, ZeroXQuoteResponse } from "./aggregators/0x";
import type { FabricConfig, FabricQuoteResponse } from "./aggregators/fabric";

export type Address = `0x${string}`;

export type ProviderKey = 'fabric' | '0x' | 'kyberswap';

type GenericAggregatorConfig<P extends ProviderKey, T> = {
  provider: P;
  config: T;
}

export type AggregatorConfig = GenericAggregatorConfig<'fabric', FabricConfig> | GenericAggregatorConfig<'0x', ZeroXConfig> | GenericAggregatorConfig<'kyberswap', KyberConfig>;


/// Discriminated union types for quote responses and errors

export type GenericQuote<P extends ProviderKey, T> = {
  success: true; // Quote was successful
  provider: P; // e.g., "0x", "kyberswap", "fabric"
  details: T; // Raw quote details from the provider
  latency: number; // in milliseconds
  outputAmount: bigint; // in basew units of output token
  networkFee: bigint; // in wei
  txData: QuoteTxData; // Common transaction data
  route?: RouteGraph; // Optional route graph (not all providers supply this)
}

export type SuccessfulQuote = GenericQuote<'0x', ZeroXQuoteResponse> | GenericQuote<'kyberswap', KyberQuoteResponse> | GenericQuote<'fabric', FabricQuoteResponse>;

export class QuoteError extends Error {
  details: unknown;
  constructor(message: string, details: unknown) {
    super(message);
    this.details = details;
  }
}

export type FailedQuote = {
  success: false;
  error?: QuoteError;
  message?: string;
  provider: ProviderKey;
};

export type Quote = SuccessfulQuote | FailedQuote;

export type SwapParams = {
  chainId: number;
  inputToken: Address;
  outputToken: Address;
  inputAmount: bigint;
  slippageBps: number;
  swapperAccount: Address;
}

export type QuoteTxData = {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
};

export type TokenNode = {
  address: Address;
  symbol?: string;
  decimals?: number;
  logoURI?: string;
}

export type PoolEdge = {
  source: Address;
  target: Address;
  address: Address;
  key: string;
  value: number;
}

export type RouteGraph = {
  nodes: TokenNode[];
  edges: PoolEdge[];
}

/// Aggregator config and types

export type MetaAggregatorConfig = {
  aggregators: AggregatorConfig[];
};