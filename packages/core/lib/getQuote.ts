import type { PublicClient } from "viem";
import type { Config } from "./createConfig.js";
import { prepareSimulatedQuotes } from "./prepareSimulatedQuotes.js";
import { selectQuote } from "./selectQuote.js";
import type { QuoteSelectionStrategy, SuccessfulSimulatedQuote, SwapParams } from "./types.js";

/**
 * Fetches quotes, simulates them, and selects a winner using the provided strategy.
 *
 * @param params - Request parameters.
 * @param params.config - Meta-aggregator configuration and providers.
 * @param params.swap - Swap request parameters.
 * @param params.strategy - Strategy used to pick the winning quote.
 * @param params.client - Optional public client used for simulation.
 * @returns Winning quote, or `null` if no provider succeeds.
 */
export async function getQuote({
  config,
  swap,
  strategy,
  client,
}: {
  config: Config;
  swap: SwapParams;
  strategy: QuoteSelectionStrategy;
  client?: PublicClient;
}): Promise<SuccessfulSimulatedQuote | null> {
  if (config.proxy?.isDeferredAction("getQuote")) {
    // If the proxy is configured to handle getQuote, delegate the entire process to the proxy server
    return await config.proxy.getQuote(swap, strategy);
  }

  const quotes = await prepareSimulatedQuotes({
    config,
    swap,
    client,
  });
  return selectQuote({
    strategy,
    quotes,
  });
}
