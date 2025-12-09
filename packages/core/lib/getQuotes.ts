import type { PublicClient } from "viem";
import type { Config } from "./createConfig.js";
import { prepareQuotes } from "./prepareQuotes.js";
import { simulateQuote } from "./simulateQuote.js";
import type { Quote, SimulatedQuote, SwapParams } from "./types.js";

/**
 * Fetches quotes from all providers and simulates quote exeuction using the provided client or client lookup.
 *
 * @param config - meta aggregation configuration.
 * @param params - Swap request parameters.
 * @param client - Public client used to simulate quote tx data.
 *
 * @returns Quotes enriched with simulation metadata.
 */
export async function getQuotes({
  config,
  params,
  client,
}: {
  config: Config;
  params: SwapParams;
  client?: PublicClient;
}): Promise<SimulatedQuote[]> {
  const resolved = client ?? config.params.clientLookup?.(params.chainId);
  if (!resolved) {
    throw new Error(
      `No PublicClient provided or configured for chainId ${params.chainId}. Please provide a client via options or constructor.`,
    );
  }

  const mapFn = async (quote: Quote): Promise<SimulatedQuote> => {
    return simulateQuote({
      client: resolved as PublicClient,
      params,
      quote,
    });
  };

  return Promise.all(prepareQuotes({ config, params, mapFn }));
}
