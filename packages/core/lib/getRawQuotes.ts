import type { Config } from "./createConfig.js";
import { prepareQuotes } from "./prepareQuotes.js";
import type { Quote, SwapParams } from "./types.js";

const QuoteIdentifyFn = async (quote: Quote): Promise<Quote> => quote;

/**
 * Fetches quotes from all providers and returns every result, including failures. Quotes are not simulated.
 *
 * @param params - Request parameters.
 * @param params.config - Meta-aggregator configuration.
 * @param params.swap - Swap request parameters.
 * @returns Array of successful or failed quote responses.
 */
export async function getRawQuotes({
  config,
  swap,
}: {
  config: Config;
  swap: SwapParams;
}): Promise<Quote[]> {
  return Promise.all(await prepareQuotes({ config, swap, mapFn: QuoteIdentifyFn }));
}
