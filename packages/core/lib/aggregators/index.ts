import type { Address } from "viem";
import {
  type AggregationOptions,
  type AggregatorFeature,
  type AggregatorMetadata,
  type ProviderConfig,
  type ProviderKey,
  type Quote,
  QuoteError,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
} from "../types.js";
import { isNativeToken } from "../util/helpers.js";
import { log } from "../util/logger.js";

const MIN_RETRIES = 0;
const MAX_RETRIES = 10;
const DEFAULT_RETRIES = 1;
const MIN_INITIAL_DELAY_MS = 5;
const MAX_INITIAL_DELAY_MS = 10_000;
const DEFAULT_INITIAL_DELAY_MS = 100;
const MIN_DEADLINE_MS = 10;
const MAX_DEADLINE_MS = 120_000;
const DEFAULT_DEADLINE_MS = 15_000;

function resolveTimingControls(options?: AggregationOptions) {
  const deadlineMs = options?.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const numRetries = options?.numRetries ?? DEFAULT_RETRIES;
  const delayMs = options?.initialRetryDelayMs ?? DEFAULT_INITIAL_DELAY_MS;

  return {
    deadlineMs: Math.min(Math.max(deadlineMs, MIN_DEADLINE_MS), MAX_DEADLINE_MS),
    numRetries: Math.min(Math.max(numRetries, MIN_RETRIES), MAX_RETRIES),
    delayMs: Math.min(Math.max(delayMs, MIN_INITIAL_DELAY_MS), MAX_INITIAL_DELAY_MS),
  };
}

/**
 * Base class for all swap aggregators, providing retry, timeout, and latency tracking helpers.
 */
export abstract class Aggregator<C extends ProviderConfig = ProviderConfig> {
  constructor(protected readonly config: C) {}

  /**
   * Provider-specific quote implementation that subclasses must supply.
   *
   * @param params - Swap request parameters.
   * @returns Provider-specific successful quote.
   */
  protected abstract tryFetchQuote(
    params: SwapParams,
    options: SwapOptions,
  ): Promise<SuccessfulQuote>;

  /**
   * Metadata about this aggregator.
   *
   * @returns Aggregator metadata such as name and documentation URL.
   */
  abstract metadata(): AggregatorMetadata;

  /**
   * Provider identifier that is surfaced to consumers.
   *
   * @returns Provider key used in quote responses.
   */
  abstract name(): ProviderKey;

  /**
   * Features supported by this aggregator.
   *
   * @returns List of supported features.
   */
  abstract features(): AggregatorFeature[];

  /**
   * Address used by this aggregator to represent the native token (differs from provider to provider)
   *
   * @returns Native token address
   */
  abstract nativeTokenAddress(): Address;

  // Helper to resolve native token addresses to provider native token address
  protected resolveTokenAddress(token: Address): Address {
    if (isNativeToken(token)) {
      return this.nativeTokenAddress();
    }
    return token;
  }

  /**
   * Optional attributes provided by the integrator for logging and analytics purposes.
   */
  get attributes() {
    return this.config.attributes;
  }

  /**
   * Determines if this aggregator supports a specific feature.
   *
   * @param feature - Feature to check.
   * @returns True when the feature is supported.
   */
  supportsFeature(feature: AggregatorFeature): boolean {
    if (this.features().includes(feature)) {
      return true;
    }
    return ((this.config.negotiatedFeatures as AggregatorFeature[]) || undefined)?.includes(
      feature,
    );
  }

  /**
   * Determines if this aggregator supports every feature in the list.
   *
   * @param features - Required features to check.
   * @returns True when all features are supported.
   */
  supportsAllFeatures(features: AggregatorFeature[]): boolean {
    return features.every((feature) => this.supportsFeature(feature));
  }

  /**
   * Attempts to fetch a quote, retrying according to the supplied aggregation options.
   *
   * @param params - Swap request parameters forwarded to the provider.
   * @param options - Optional retry/backoff configuration.
   * @returns Successful or failed quote result.
   */
  async fetchQuote(params: SwapParams, options?: AggregationOptions): Promise<Quote> {
    const resolvedParams: SwapParams = {
      ...params,
      inputToken: this.resolveTokenAddress(params.inputToken),
      outputToken: this.resolveTokenAddress(params.outputToken),
    };

    const effectiveOptions =
      this.config.timeoutMs === undefined
        ? options
        : { ...(options ?? {}), deadlineMs: this.config.timeoutMs };
    const { delayMs, numRetries, deadlineMs } = resolveTimingControls(effectiveOptions);

    const quoteCall = async () => {
      let numAttempts = 0;
      let error: Quote | null = null;

      while (numAttempts <= numRetries) {
        try {
          const start = performance.now();
          const quote = await this.tryFetchQuote(resolvedParams, effectiveOptions || {});
          const stop = performance.now();
          return {
            ...quote,
            latency: stop - start,
            providerAttributes: this.config.attributes,
          };
        } catch (e) {
          log("debug", "Quote attempt failed", {
            provider: this.name(),
            attempt: numAttempts + 1,
            error: e,
          });
          error = {
            success: false,
            provider: this.name(),
            error: e as QuoteError,
            providerAttributes: this.config.attributes,
          };

          // Early terminate to prevent a sleep when we plan to bail
          numAttempts += 1;
          if (numAttempts > numRetries) {
            break;
          }
          // Sleep for delay * 2 ** numAttempts-1 milliseconds before retrying
          await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** (numAttempts - 1)));
        }
      }

      log("info", "Quote failed after retries", {
        provider: this.name(),
        attempts: numAttempts,
      });

      return error as Quote;
    };

    if (deadlineMs > 0) {
      return Promise.race([
        quoteCall(),
        deadline({ deadlineMs, aggregator: this.name(), attributes: this.config.attributes }),
      ]);
    }

    return quoteCall();
  }
}

export async function deadline({
  deadlineMs,
  aggregator,
  attributes,
}: {
  deadlineMs: number;
  aggregator: ProviderKey;
  attributes?: Record<string, unknown>;
}): Promise<Quote> {
  await new Promise((resolve) => setTimeout(resolve, deadlineMs));
  log("debug", "Quote deadline exceeded", { provider: aggregator, deadlineMs });
  return {
    success: false,
    provider: aggregator,
    error: new QuoteError(`MetaAggregator deadline exceeded after ${deadlineMs}ms`, ""),
    providerAttributes: attributes,
  };
}
