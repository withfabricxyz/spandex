import type { PublicClient } from "viem";
import type { Config } from "./createConfig.js";
import { prepareSimulatedQuotes } from "./prepareSimulatedQuotes.js";
import type { SimulatedQuote, SimulationOptions, SwapParams } from "./types.js";

/**
 * Fetches quotes from all providers and simulates execution using the provided or configured client.
 *
 * @param params - Request parameters.
 * @param params.config - Meta-aggregator configuration.
 * @param params.swap - Swap request parameters.
 * @param params.client - Public client used to simulate quote transaction data.
 * @param params.simulationOptions - Optional simulation controls, including state overrides.
 * @returns Quotes enriched with simulation metadata.
 */
export async function getQuotes({
  config,
  swap,
  client,
  simulationOptions,
}: {
  config: Config;
  swap: SwapParams;
  client?: PublicClient;
  simulationOptions?: SimulationOptions;
}): Promise<SimulatedQuote[]> {
  return Promise.all(await prepareSimulatedQuotes({ config, swap, client, simulationOptions }));
}
