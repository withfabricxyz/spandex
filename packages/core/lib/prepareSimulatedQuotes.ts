import type { PublicClient } from "viem";
import type { Config } from "./createConfig.js";
import { prepareQuotes } from "./prepareQuotes.js";
import { simulateQuote } from "./simulateQuote.js";
import type { Quote, SimulatedQuote, SimulationOptions, SwapParams } from "./types.js";

/**
 * Prepares simulated quotes by fetching quotes from all configured aggregators then simulating them.
 *
 * @param params - Request parameters.
 * @param params.config - Meta-aggregator configuration.
 * @param params.swap - Swap request parameters.
 * @param params.client - Public client used to simulate quote transaction data.
 * @param params.simulationOptions - Optional simulation controls, including state overrides.
 * @returns Quotes enriched with simulation metadata.
 */
export async function prepareSimulatedQuotes({
  config,
  swap,
  client,
  simulationOptions,
}: {
  config: Config;
  swap: SwapParams;
  client?: PublicClient;
  simulationOptions?: SimulationOptions;
}): Promise<Promise<SimulatedQuote>[]> {
  if (config.proxy?.isDelegatedAction("prepareSimulatedQuotes")) {
    return config.proxy.prepareSimulatedQuotes(swap, simulationOptions);
  }

  if (config.proxy && config.aggregators.length === 0) {
    throw new Error(
      "prepareSimulatedQuotes is not delegated on this proxy config. Add `prepareSimulatedQuotes` to delegatedActions or configure local providers.",
    );
  }

  const resolved = client ?? config.clientLookup(swap.chainId);
  if (!resolved) {
    throw new Error(
      `No PublicClient provided or configured for chainId ${swap.chainId}. Please provide a client via options or constructor.`,
    );
  }

  const mapFn = async (quote: Quote): Promise<SimulatedQuote> => {
    return simulateQuote({
      client: resolved as PublicClient,
      swap,
      quote,
      simulationOptions,
    });
  };

  return await prepareQuotes({ config, swap, mapFn });
}
