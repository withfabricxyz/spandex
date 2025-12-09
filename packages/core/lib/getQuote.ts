import type { Config } from "./createConfig.js";
import { prepareQuotes } from "./prepareQuotes.js";
import { selectQuote } from "./selectQuote.js";
import type { Quote, QuoteSelectionStrategy, SuccessfulQuote, SwapParams } from "./types.js";

/**
 * Fetches quotes and applies the configured strategy to pick the best result.
 *
 * @param params - Swap request parameters.
 * @param options - Strategy configuration for selecting the winning quote.
 *
 * @returns Winning quote, or `null` if no provider succeeds.
 */
export async function getQuote({
  config,
  params,
  strategy,
}: {
  config: Config;
  params: SwapParams;
  strategy: QuoteSelectionStrategy;
}): Promise<SuccessfulQuote | null> {
  // TODO: Only simulated quotes
  return selectQuote({
    strategy,
    quotes: prepareQuotes({ config, params, mapFn: (quote: Quote) => Promise.resolve(quote) }),
  });
}
