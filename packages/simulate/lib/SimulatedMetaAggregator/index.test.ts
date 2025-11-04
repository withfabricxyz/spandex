import { describe, expect, it } from "bun:test";
import { buildMetaAggregator } from "@withfabric/smal";
import type { PublicClient } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { SimulatedMetaAggregator } from "./";

describe("SimulatedMetaAggregator", () => {
  const client = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  }) as PublicClient;

  const metaAgg = buildMetaAggregator({
    aggregators: [
      { provider: "fabric", config: {} },
      { provider: "odos", config: {} },
    ],
  });

  const simulator = new SimulatedMetaAggregator(metaAgg, client);

  it("composes MetaAggregator and returns simulated quotes", async () => {
    const quotes = await simulator.fetchQuotes({
      chainId: 8453,
      inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      outputToken: "0x4200000000000000000000000000000000000006",
      inputAmount: 1000000n,
      swapperAccount: "0xdead00000000000000000000000000000000beef",
      slippageBps: 50,
    });

    expect(quotes).toBeDefined();
    expect(Array.isArray(quotes)).toBe(true);

    if (quotes.length > 0) {
      const quote = quotes[0];
      if (!quote) return;

      expect(quote.simulation).toBeDefined();
      expect(typeof quote.simulation.success).toBe("boolean");

      if (quote.simulation.success) {
        expect(quote.simulation.outputAmount).toBeDefined();
        expect(typeof quote.simulation.outputAmount).toBe("bigint");
      }
    }
  }, 30_000);

  it("exposes providers from wrapped MetaAggregator", () => {
    expect(simulator.providers).toEqual(metaAgg.providers);
  });
});
