import type { Provider } from "react";
import type { KyberConfig } from "./aggregators/kyber";
import type { ZeroXConfig } from "./aggregators/0x";
import type { FabricConfig } from "./aggregators/fabric";
import type { LifiConfig } from "./aggregators/lifi";

export type Address = `0x${string}`;

// Discriminated union of provider configs
export type ProviderConfig = (LifiConfig &{
  provider: "lifi",
}) | (FabricConfig &{
  provider: "fabric",
}) | (ZeroXConfig & {
  provider: "0x",
}) | (KyberConfig & {
  provider: "kyberswap",
});

export type SwapParams = {
  chainId: number;
  inputToken: Address;
  outputToken: Address;
  inputAmount: bigint;
  slippageBps: number;
  swapperAccount: Address;
}

export type QuoteDetail = {
  outputAmount: bigint;
  networkFee: bigint;
  blockNumber?: number;
  txData: QuoteTxData;
  // details: string;
};

export type FailedQuote = {
  success: false;
  error: QuoteError;
  provider: string;
};

export type TimedQuote =
  | {
      success: true;
      quote: QuoteDetail;
      latency: number;
      provider: string;
    }
  | FailedQuote;

export class QuoteError extends Error {
  constructor(
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "RouteError";
  }
}

export type QuoteTxData = {
  to: Address;
  data: `0x${string}`;
};

/// Route types for constructing route graphs

export type RouteEdge = {
  pool: string;
  to: RouteNode;
  amountIn: bigint;
  amountOut: bigint;
}

export type RouteNode = {
  token: Address;
  edges: RouteEdge[];
}

export type RouteDAG = {
  root: RouteNode;
};


/// Aggregator config and types

export type MetaAggregatorConfig = {
  providers: ProviderConfig[];
};