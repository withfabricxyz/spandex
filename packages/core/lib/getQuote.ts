import type { PublicClient } from "viem";
import type { Config } from "./createConfig.js";
import { prepareQuotes } from "./prepareQuotes.js";
import { selectQuote } from "./selectQuote.js";
import { simulateQuote } from "./simulateQuote.js";
import type { QuoteSelectionStrategy, SuccessfulSimulatedQuote, SwapParams } from "./types.js";

/**
 * Fetches quotes, simulates them, and selects a winner using the provided strategy.
 *
 * @param params - Request parameters.
 * @param params.config - Meta-aggregator configuration and providers.
 * @param params.swap - Swap request parameters.
 * @param params.strategy - Strategy used to pick the winning quote.
 * @param params.client - Optional public client used for simulation.
 * @param params.simulate - Optional simulation function override.
 * @returns Winning quote, or `null` if no provider succeeds.
 */
export async function getQuote({
  config,
  swap,
  strategy,
  client,
  simulate = simulateQuote,
}: {
  config: Config;
  swap: SwapParams;
  strategy: QuoteSelectionStrategy;
  client?: PublicClient;
  simulate?: typeof simulateQuote;
}): Promise<SuccessfulSimulatedQuote | null> {
  const resolvedClient = client ?? config.clientLookup(swap.chainId);
  if (!resolvedClient) {
    throw new Error(
      `No PublicClient provided or configured for chainId ${swap.chainId}. Please provide a client via options or constructor.`,
    );
  }

  return selectQuote({
    strategy,
    quotes: await prepareQuotes({
      config,
      swap,
      mapFn: (quote) =>
        simulate({
          client: resolvedClient,
          swap,
          quote,
        }),
    }),
  });
}
