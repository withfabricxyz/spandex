import type { ZeroXConfig, ZeroXQuoteResponse } from "./aggregators/0x.js";
import type { FabricConfig, FabricQuoteResponse } from "./aggregators/fabric.js";
import type { KyberConfig, KyberQuoteResponse } from "./aggregators/kyber.js";
import type { OdosConfig, OdosQuoteResponse } from "./aggregators/odos.js";

export type Address = `0x${string}`;

export type ProviderKey = "fabric" | "0x" | "kyberswap" | "odos";

type GenericAggregatorConfig<P extends ProviderKey, T> = {
  provider: P;
  config: T;
};

export type AggregatorConfig =
  | GenericAggregatorConfig<"fabric", FabricConfig>
  | GenericAggregatorConfig<"0x", ZeroXConfig>
  | GenericAggregatorConfig<"kyberswap", KyberConfig>
  | GenericAggregatorConfig<"odos", OdosConfig>;

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
};

export type SuccessfulQuote =
  | GenericQuote<"0x", ZeroXQuoteResponse>
  | GenericQuote<"kyberswap", KyberQuoteResponse>
  | GenericQuote<"fabric", FabricQuoteResponse>
  | GenericQuote<"odos", OdosQuoteResponse>;

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
};

// TODO: We need union for exact_out style quoting

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
};

export type PoolEdge = {
  source: Address;
  target: Address;
  address: Address;
  key: string;
  value: number;
};

export type RouteGraph = {
  nodes: TokenNode[];
  edges: PoolEdge[];
};

/// Aggregator config and types
// TODO: We need global configuration for top level, eg: timeouts, retries, fee config, prefered strategy, etc.
// TODO: Initial strategies: fastest, price, gas efficient, custom (fn parameter that takes a set of quotes and returns one)

export type MetaAggregatorConfig = {
  aggregators: AggregatorConfig[];
};
