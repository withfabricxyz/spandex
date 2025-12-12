import type { Config } from "./createConfig.js";
import { prepareQuotes } from "./prepareQuotes.js";
import type { Quote, SwapParams } from "./types.js";

const QuoteIdentifyFn = async (quote: Quote): Promise<Quote> => quote;

/**
 * Fetches quotes from all providers and returns every result, including failures. These quotes are not simulated.
 *
 * @param config - MetaAggregator configuration.
 * @param params - Swap request parameters.
 * @returns Array of successful or failed quote responses.
 */
export async function getRawQuotes({
  config,
  swap,
}: {
  config: Config;
  swap: SwapParams;
}): Promise<Quote[]> {
  return Promise.all(prepareQuotes({ config, swap, mapFn: QuoteIdentifyFn }));
}
