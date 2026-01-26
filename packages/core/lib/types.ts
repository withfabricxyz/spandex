import type { Address, PublicClient, SimulateCallsReturnType } from "viem";
import type { ZeroXConfig, ZeroXQuoteResponse } from "./aggregators/0x.js";
import type { FabricConfig, FabricQuoteResponse } from "./aggregators/fabric.js";
import type { Aggregator } from "./aggregators/index.js";
import type { KyberConfig, KyberQuoteResponse } from "./aggregators/kyber.js";
import type { LifiConfig, LifiQuoteResponse } from "./aggregators/lifi.js";
import type { OdosConfig, OdosQuoteResponse } from "./aggregators/odos.js";
import type { RelayConfig, RelayQuoteResponse } from "./aggregators/relay.js";
import type { AggregatorProxy } from "./wire/proxy.js";

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
  lifi: {
    config: LifiConfig;
    quote: LifiQuoteResponse;
  };
  odos: {
    config: OdosConfig;
    quote: OdosQuoteResponse;
  };
  relay: {
    config: RelayConfig;
    quote: RelayQuoteResponse;
  };
};

/**
 * Keys that identify which provider produced a quote.
 */
export type ProviderKey = keyof ProviderDefinitions;

/**
 * Shared configuration supported by all providers.
 */
export type ProviderConfig = {
  /**
   * Provider-specific timeout that overrides the meta-aggregator deadline.
   */
  timeoutMs?: number;
  /**
   * Optional negotiated features that can be forced on for a provider.
   * Only integrator fee/surplus capabilities are supported here.
   */
  negotiatedFeatures?: NegotiatedFeature[];
};

/**
 * Features that an aggregator may support. Used for capability detection and filtering.
 */
export type AggregatorFeature = "exactIn" | "targetOut" | "integratorFees" | "integratorSurplus";

/**
 * Features that can be enabled via negotiated terms.
 */
export type NegotiatedFeature = "integratorFees" | "integratorSurplus";

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
  txData: TxData;
  /**
   * Approval details if an approval is required before executing the swap.
   */
  approval?: {
    /** Address of the token that needs to be approved. */
    token: Address;
    /** Address of the spender that must be approved. */
    spender: Address;
  };
  /**
   * Optional route visualization supplied by the provider.
   */
  route?: RouteGraph;
  /**
   * Optional pricing metadata for the input/output tokens.
   */
  pricing?: QuotePricing;
  /**
   * Optional fee details associated with the quote.
   */
  fees?: Fee[];
  /**
   * Optional metrics such as price impact.
   */
  metrics?: QuoteMetrics;
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

  override get name() {
    return "QuoteError";
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
export type TxData = {
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
 * Token metadata enriched with pricing signals.
 */
export type TokenPricing = TokenNode & {
  /**
   * USD price per 1 unit of the token.
   */
  usdPrice?: number;
};

/**
 * Pricing details attached to a quote.
 */
export type QuotePricing = {
  /**
   * Input token pricing metadata.
   */
  inputToken?: TokenPricing;
  /**
   * Output token pricing metadata.
   */
  outputToken?: TokenPricing;
};

/**
 * Fee breakdown item.
 */
export type Fee = {
  /**
   * Fee category.
   */
  type: "network" | "integrator" | "aggregator" | "relayer" | "app" | "other";
  /**
   * Optional token address for the fee.
   */
  token?: Address;
  /**
   * Fee amount in base units.
   */
  amount?: bigint;
};

/**
 * Quote quality metrics.
 */
export type QuoteMetrics = {
  /**
   * Price impact expressed in basis points.
   */
  priceImpactBps?: number;
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
  /**
   * Address that should receive the integrator surplus. Defaults to `integratorFeeAddress` if not specified.
   */
  integratorSurplusAddress?: Address;
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

type ClientLookup = PublicClient[] | ((chainId: number) => PublicClient | undefined);

/**
 * Configuration for constructing a MetaAggregator instance with direct provider access.
 */
export type DirectConfigParams = {
  /**
   * Aggregation providers to fetch quotes from.
   */
  providers: Aggregator[];
  /**
   * Clients used to simulate quotes (one per chain).
   */
  clients?: ClientLookup;
  /**
   * Default options applied to the meta-aggregator and the individual provider calls.
   */
  options?: AggregationOptions;
  /**
   * Cannot specify proxy when using direct providers.
   */
  proxy?: never;
};

/**
 * Configuration for constructing a MetaAggregator instance with proxy-based quote fetching.
 */
export type ProxyConfigParams = {
  /**
   * Proxy instance used to delegate quote fetching from client to server. Useful in browser environments where CORS constraints exist with providers.
   */
  proxy: AggregatorProxy;
  /**
   * Clients used to simulate quotes (one per chain).
   */
  clients?: ClientLookup;
  /**
   * Cannot specify providers when using a proxy.
   */
  providers?: never;
  /**
   * Options are configured by the proxy, not at client-side config time.
   */
  options?: never;
};

/**
 * Configuration parameters for creating a Spandex config.
 * Use either `providers` for direct aggregator access, or `proxy` for server-side quote fetching.
 */
export type ConfigParams = DirectConfigParams | ProxyConfigParams;

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
  swap: SwapParams;
  /** Quote to simulate, including the encoded transaction data. */
  quote: Quote;
};

/**
 * Transfer event data extracted from simulation logs.
 */
export type TransferData = {
  /** Index of the transfer event in the log array. */
  index: number;
  /** Address of the token being transferred. */
  token: Address;
  /** Address sending the tokens. */
  from: Address;
  /** Address receiving the tokens. */
  to: Address;
  /** Amount of tokens transferred (denominated in base units). */
  value: bigint;
};

/** Result of a successful quote simulation.
 *
 * @public
 */
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
  /** ERC-20 Transfer events extracted from the simulation logs. */
  transfers: TransferData[];
  /** Asset changes observed on the swapper account during simulation. */
  assetChanges: readonly {
    token: {
      address: Address;
      decimals?: number | undefined;
      symbol?: string | undefined;
    };
    value: { pre: bigint; post: bigint; diff: bigint };
  }[];
};

/** Result of a failed quote simulation.
 *
 * @public
 */
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
 * Quote decorated with the corresponding simulation result, both successful.
 *
 * @public
 */
export type SuccessfulSimulatedQuote = SuccessfulQuote & {
  /** Successful simulation metadata for the quote. */
  simulation: SimulationSuccess;
};

/**
 * Quote decorated with a failed simulation result.
 *
 * @public
 */
export type FailedSimulatedQuote = Quote & {
  /** Error metadata describing why simulation failed. */
  simulation: SimulationFailure;
};

/**
 * Quote decorated with the corresponding simulation result.
 *
 * @public
 */
export type SimulatedQuote = SuccessfulSimulatedQuote | FailedSimulatedQuote;

/**
 * Comparator used when sorting simulated quotes.
 */
export type SimulatedQuoteSort = (
  a: SuccessfulSimulatedQuote,
  b: SuccessfulSimulatedQuote,
) => number;

/**
 * Custom strategy function used to pick a winning quote.
 */
export type QuoteSelectionFn = (
  quotes: Array<Promise<SimulatedQuote>>,
) => Promise<SuccessfulSimulatedQuote | null>;

/**
 * Built-in strategies for ranking quote responses.
 */
export type QuoteSelectionName = "fastest" | "bestPrice" | "estimatedGas" | "priority";

/**
 * Strategy reference, either by name or via custom function.
 */
export type QuoteSelectionStrategy = QuoteSelectionName | QuoteSelectionFn;

/**
 * Aggregated pricing summary derived from multiple quotes.
 */
export type PricingSummary = {
  /**
   * Input token pricing summary.
   */
  inputToken?: TokenPricing;
  /**
   * Output token pricing summary.
   */
  outputToken?: TokenPricing;
  /**
   * Providers that contributed pricing signals.
   */
  sources: ProviderKey[];
};
