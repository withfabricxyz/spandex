import type { PublicClient, SimulateCallsReturnType } from "viem";
import type { ZeroXConfig, ZeroXQuoteResponse } from "./aggregators/0x.js";
import type { FabricConfig, FabricQuoteResponse } from "./aggregators/fabric.js";
import type { KyberConfig, KyberQuoteResponse } from "./aggregators/kyber.js";
import type { OdosConfig, OdosQuoteResponse } from "./aggregators/odos.js";

/**
 * Ethereum-style hexadecimal address literal prefixed with `0x`.
 */
export type Address = `0x${string}`;

/**
 * Generic hexadecimal literal prefixed with `0x`.
 */
export type Hex = `0x${string}`;

/**
 * Definitions for each supported provider including their configuration and quote response types.
 */
export type ProviderDefinitions = {
  fabric: {
    config: FabricConfig;
    quote: FabricQuoteResponse;
  };
  "0x": {
    config: ZeroXConfig;
    quote: ZeroXQuoteResponse;
  };
  kyberswap: {
    config: KyberConfig;
    quote: KyberQuoteResponse;
  };
  odos: {
    config: OdosConfig;
    quote: OdosQuoteResponse;
  };
};

/**
 * Keys that identify which provider produced a quote.
 */
export type ProviderKey = keyof ProviderDefinitions;

/**
 * Provider-specific configuration keyed by the provider identifier.
 *
 * Supply only the providers you want enabled; omitted keys are skipped entirely.
 */
export type ProviderConfig = Partial<{ [K in ProviderKey]: ProviderDefinitions[K]["config"] }>;

/**
 * Features that an aggregator may support. Used for capability detection and filtering.
 */
export type AggregatorFeature = "exactIn" | "targetOut" | "integratorFees" | "integratorSurplus";

/**
 * Metadata about an dex aggregation provider.
 */
export type AggregatorMetadata = {
  name: string;
  url: string;
  docsUrl: string;
  logoUrl?: string;
};

/**
 * Successful quote shape returned by an individual provider.
 *
 * @typeParam P - Provider identifier.
 * @typeParam T - Raw quote payload returned by the provider.
 */
export type GenericQuote<P extends ProviderKey, T> = {
  /**
   * Indicates that the quote succeeded.
   */
  success: true;
  /**
   * Provider that produced the quote.
   */
  provider: P;
  /**
   * Raw provider response kept for downstream consumers.
   */
  details: T;
  /**
   * Round-trip latency in milliseconds.
   */
  latency: number;
  /**
   * Amount of output token received or bought (denominated in base units).
   */
  outputAmount: bigint;
  /**
   * Amount of input token sent or sold (denominated in base units).
   */
  inputAmount: bigint;
  /**
   * Estimated network fee in wei.
   */
  networkFee: bigint;
  /**
   * Transaction data that can be submitted to perform the swap.
   */
  txData: QuoteTxData;
  /**
   * Optional route visualization supplied by the provider.
   */
  route?: RouteGraph;
};

/**
 * Union of successful quote shapes for every supported provider.
 */
export type SuccessfulQuote = {
  [K in ProviderKey]: GenericQuote<K, ProviderDefinitions[K]["quote"]>;
}[ProviderKey];

/**
 * Custom error used to surface provider-specific failures.
 */
export class QuoteError extends Error {
  /**
   * Creates a new quote error.
   *
   * @param message - Human readable error description.
   * @param details - Provider response payload for debugging - or `undefined` if not applicable.
   */
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Failed quote result returned when a provider cannot produce a swap.
 */
export type FailedQuote = {
  /**
   * Indicates that the quote failed.
   */
  success: false;
  /**
   * Optional structured error returned by the provider.
   */
  error?: QuoteError;
  /**
   * Provider that failed to produce a quote.
   */
  provider: ProviderKey;
};

/**
 * Result union representing either a successful or failed quote.
 */
export type Quote = SuccessfulQuote | FailedQuote;

type SwapBase = {
  /**
   * Chain identifier (EIP-155).
   */
  chainId: number;
  /**
   * Address of the token being sold.
   */
  inputToken: Address;
  /**
   * Address of the token being purchased.
   */
  outputToken: Address;
  /**
   * Allowed slippage expressed in basis points.
   */
  slippageBps: number;
  /**
   * Account that will submit the swap transaction.
   */
  swapperAccount: Address;
};

export type ExactInSwapParams = SwapBase & {
  mode: "exactIn";
  /**
   * Amount of input token to sell (denominated in base units).
   */
  inputAmount: bigint;
};

export type TargetOutSwapParams = SwapBase & {
  mode: "targetOut";
  /**
   * Amount of output token to purchase (denominated in base units).
   */
  outputAmount: bigint;
};

/**
 * Parameters required to request a swap quote.
 */
export type SwapParams = ExactInSwapParams | TargetOutSwapParams;

/**
 * Transaction payload emitted alongside a quote.
 */
export type QuoteTxData = {
  /**
   * Contract address that should receive the call.
   */
  to: Address;
  /**
   * Calldata to execute for the swap.
   */
  data: `0x${string}`;
  /**
   * Optional ETH amount (wei) to send with the transaction.
   */
  value?: bigint;
};

/**
 * Graph node describing a token involved in a swapping route.
 */
export type TokenNode = {
  /**
   * Token contract address.
   */
  address: Address;
  /**
   * Short ticker symbol when available.
   */
  symbol?: string;
  /**
   * Number of decimals used by the token.
   */
  decimals?: number;
  /**
   * Optional logo URL for UI rendering.
   */
  logoURI?: string;
};

/**
 * Directed edge describing a pool hop between two tokens.
 */
export type PoolEdge = {
  /**
   * Token being sold on this hop.
   */
  source: Address;
  /**
   * Token received on this hop.
   */
  target: Address;
  /**
   * Liquidity pool contract address.
   */
  address?: Address;
  /**
   * Unique identifier for the edge within a route.
   */
  key: string;
  /**
   * Amount routed through the edge (provider-specific units).
   */
  value: number;
};

/**
 * Route visualization returned by some providers.
 */
export type RouteGraph = {
  /**
   * Tokens involved in the swap path.
   */
  nodes: TokenNode[];
  /**
   * Pool hops connecting the tokens.
   */
  edges: PoolEdge[];
};

/**
 * Options controlling retry and timeout behavior for quote requests.
 */
export type TimingOptions = {
  /**
   * Maximum duration for the entire aggregation process before aborting pending requests.
   */
  deadlineMs?: number;
  /**
   * Number of retry attempts per provider.
   */
  numRetries?: number;
  /**
   * Initial delay before retrying failed requests (exponential backoff applied).
   */
  initialRetryDelayMs?: number;
};

/**
 * Options for configuring integrator fees and surplus sharing.
 */
export type FeeOptions = {
  /**
   * Address that should receive the integrator fee.
   */
  integratorFeeAddress?: Address;
  /**
   * Swap fee for the integrator (in basis points). Only applicable if the provider supports integrator fees.
   */
  integratorSwapFeeBps?: number;
  /**
   * Surplus share for the integrator (in basis points). Only applicable if the provider supports surplus sharing.
   */
  integratorSurplusBps?: number;
};

/**
 * Optional parameters for aggregator quote requests.
 */
export type SwapOptions = FeeOptions;

/**
 * Combined aggregation options.
 *
 * Retry/deadline knobs are clamped to safe ranges in `resolveTimingControls`, and fee knobs are
 * passed through to providers that support integrator fees/surplus.
 */
export type AggregationOptions = TimingOptions & FeeOptions;

/**
 * Custom strategy function used to pick a winning quote.
 */
export type QuoteSelectionFn = (quotes: Array<Promise<Quote>>) => Promise<SuccessfulQuote | null>;

/**
 * Built-in strategies for ranking quote responses.
 */
export type QuoteSelectionName = "fastest" | "quotedPrice" | "quotedGas" | "priority";

/**
 * Strategy reference, either by name or via custom function.
 */
export type QuoteSelectionStrategy = QuoteSelectionName | QuoteSelectionFn;

/**
 * Configuration for constructing a MetaAggregator instance.
 */
export type MetaAggregatorConfig = {
  /**
   * Provider-specific configuration keyed by provider identifier (optional to allow a subset).
   */
  providers: ProviderConfig;
  /**
   * Clients used to simulate quotes (one per chain).
   */
  clientLookup?: (chainId: number) => PublicClient | undefined;
  /**
   * Default options applied to the meta-aggregator and the individual provider calls.
   */
  options?: AggregationOptions;
};

///////////////////// Simulation Types /////////////////////

/**
 * Parameters required to simulate a single quote.
 *
 * @public
 */
export type SimulationArgs = {
  /** Public client used to execute `simulateCalls`. */
  client: PublicClient;
  /** Swap parameters shared across quotes, including token, account, and amount details. */
  params: SwapParams;
  /** Quote to simulate, including the encoded transaction data. */
  quote: Quote;
};

export type SimulationSuccess = {
  /** Indicates the simulation completed without errors. */
  success: true;
  /** Final output token amount derived from asset changes. */
  outputAmount: bigint;
  /** Raw `simulateCalls` results for each executed call. */
  callsResults: SimulateCallsReturnType["results"];
  /** Gas used for the swap call. */
  gasUsed?: bigint;
  /** Client-measured duration in milliseconds for the simulated call batch. */
  latency: number;
  /** Block number tied to the simulation response, if the client returned one. */
  blockNumber: bigint | null;
};

export type SimulationFailure = {
  /** Indicates the simulation failed and `error` contains the reason. */
  success: false;
  /** Underlying error describing the failure. */
  error: Error;
};

/**
 * Result of simulating a quote, including aggregated metadata on success.
 *
 * @public
 */
export type SimulationResult = SimulationSuccess | SimulationFailure;

/**
 * Quote decorated with the corresponding simulation result.
 *
 * @public
 */
export type SimulatedQuote = Quote & {
  /** Result data describing the simulation outcome for the quote. */
  simulation: SimulationResult;
};
