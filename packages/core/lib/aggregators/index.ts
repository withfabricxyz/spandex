import {
  type AggregationOptions,
  type AggregatorFeature,
  type AggregatorMetadata,
  type ProviderKey,
  type Quote,
  QuoteError,
  type SuccessfulQuote,
  type SwapOptions,
  type SwapParams,
} from "../types.js";

const MIN_RETRIES = 0;
const MAX_RETRIES = 10;
const DEFAULT_RETRIES = 1;
const MIN_INITIAL_DELAY_MS = 5;
const MAX_INITIAL_DELAY_MS = 10_000;
const DEFAULT_INITIAL_DELAY_MS = 100;
const MIN_DEADLINE_MS = 10;
const MAX_DEADLINE_MS = 120_000;
const DEFAULT_DEADLINE_MS = 8_000;

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
export abstract class Aggregator {
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
   * Attempts to fetch a quote, retrying according to the supplied aggregation options.
   *
   * @param params - Swap request parameters forwarded to the provider.
   * @param options - Optional retry/backoff configuration.
   * @returns Successful or failed quote result.
   */
  async fetchQuote(params: SwapParams, options?: AggregationOptions): Promise<Quote> {
    const { delayMs, numRetries, deadlineMs } = resolveTimingControls(options);

    const quoteCall = async () => {
      let numAttempts = 0;
      let error: Quote | null = null;

      while (numAttempts <= numRetries) {
        try {
          const start = performance.now();
          const quote = await this.tryFetchQuote(params, options || {});
          const stop = performance.now();
          return {
            ...quote,
            latency: stop - start,
          };
        } catch (e) {
          error = {
            success: false,
            provider: this.name(),
            error: e as QuoteError,
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

      return error as Quote;
    };

    if (deadlineMs > 0) {
      return Promise.race([quoteCall(), deadline({ deadlineMs, aggregator: this.name() })]);
    }

    return quoteCall();
  }
}

export async function deadline({
  deadlineMs,
  aggregator,
}: {
  deadlineMs: number;
  aggregator: ProviderKey;
}): Promise<Quote> {
  await new Promise((resolve) => setTimeout(resolve, deadlineMs));
  return {
    success: false,
    provider: aggregator,
    error: new QuoteError(`MetaAggregator deadline exceeded after ${deadlineMs}ms`, ""),
  };
}
