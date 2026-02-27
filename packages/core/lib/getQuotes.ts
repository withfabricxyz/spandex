import type { PublicClient } from "viem";
import type { Config } from "./createConfig.js";
import { prepareSimulatedQuotes } from "./prepareSimulatedQuotes.js";
import type { SimulatedQuote, SwapParams } from "./types.js";

/**
 * Fetches quotes from all providers and simulates execution using the provided or configured client.
 *
 * @param params - Request parameters.
 * @param params.config - Meta-aggregator configuration.
 * @param params.swap - Swap request parameters.
 * @param params.client - Public client used to simulate quote transaction data.
 * @returns Quotes enriched with simulation metadata.
 */
export async function getQuotes({
  config,
  swap,
  client,
}: {
  config: Config;
  swap: SwapParams;
  client?: PublicClient;
}): Promise<SimulatedQuote[]> {
  if (config.proxy?.isDeferredAction("getQuotes")) {
    // If the proxy is configured to handle getQuotes, delegate the entire process to the proxy server
    return await config.proxy.getQuotes(swap);
  }

  return Promise.all(await prepareSimulatedQuotes({ config, swap, client }));
}
