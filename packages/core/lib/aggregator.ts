import type {
  AggregationOptions,
  ProviderKey,
  Quote,
  QuoteError,
  SuccessfulQuote,
  SwapParams,
} from "./types.js";

const MIN_RETRIES = 0;
const MAX_RETRIES = 10;
const DEFAULT_RETRIES = 1;
const MIN_INITIAL_DELAY_MS = 20;
const MAX_INITIAL_DELAY_MS = 10_000;
const DEFAULT_INITIAL_DELAY_MS = 500;

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
  protected abstract tryFetchQuote(params: SwapParams): Promise<SuccessfulQuote>;

  /**
   * Provider identifier that is surfaced to consumers.
   *
   * @returns Provider key used in quote responses.
   */
  abstract name(): ProviderKey;

  /**
   * Attempts to fetch a quote, retrying according to the supplied aggregation options.
   *
   * @param params - Swap request parameters forwarded to the provider.
   * @param options - Optional retry/backoff configuration.
   * @returns Successful or failed quote result.
   */
  async fetchQuote(params: SwapParams, options?: AggregationOptions): Promise<Quote> {
    const delay = Math.min(
      Math.max(options?.initialRetryDelayMs ?? DEFAULT_INITIAL_DELAY_MS, MIN_INITIAL_DELAY_MS),
      MAX_INITIAL_DELAY_MS,
    );
    const numRetries = Math.min(
      Math.max(options?.numRetries ?? DEFAULT_RETRIES, MIN_RETRIES),
      MAX_RETRIES,
    );

    let numAttempts = 0;
    let error: Quote | null = null;

    while (numAttempts <= numRetries) {
      try {
        const start = performance.now();
        // TODO: Race with a timeout based on options?.timeoutMs
        const quote = await this.tryFetchQuote(params);
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
        await new Promise((resolve) => setTimeout(resolve, delay * 2 ** (numAttempts - 1)));
      }
    }

    return error as Quote;
  }
}
