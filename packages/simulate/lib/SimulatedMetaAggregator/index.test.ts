import { describe, expect, it } from "bun:test";
import { buildMetaAggregator } from "@withfabric/smal";
import { defaultSwapParams } from "@withfabric/smal/test/utils";
import type { PublicClient } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { SimulatedMetaAggregator } from "./";

const ANKR_API_KEY = process.env.ANKR_API_KEY || "";

describe("SimulatedMetaAggregator", () => {
  const client = createPublicClient({
    chain: base,
    transport: http(`https://rpc.ankr.com/base/${ANKR_API_KEY}`),
  }) as PublicClient;

  const metaAgg = buildMetaAggregator({
    aggregators: [
      // { provider: "odos", config: {} },
      { provider: "kyberswap", config: { clientId: "smal" } },
      // { provider: "0x", config: { apiKey: process.env.ZEROX_API_KEY || "" } },
    ],
  });

  const simulator = new SimulatedMetaAggregator(metaAgg, client);

  it("composes MetaAggregator and returns simulated quotes", async () => {
    const quotes = await simulator.fetchQuotes({
      ...defaultSwapParams,
      swapperAccount: "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055", // 🐳
    });

    expect(quotes).toBeDefined();
    expect(Array.isArray(quotes)).toBe(true);

    const [successful, failed] = quotes.reduce(
      (acc, quote) => {
        if (quote.simulation.success) {
          acc[0].push(quote);
        } else {
          acc[1].push(quote);
        }
        return acc;
      },
      [[] as typeof quotes, [] as typeof quotes],
    );

    if (successful.length > 0) {
      console.log("\nSuccessful simulations:");
      console.table(
        successful.map((quote) => ({
          provider: quote.provider,
          outputAmount: quote.simulation.success ? quote.simulation.outputAmount.toString() : "N/A",
          gasUsed: quote.simulation.success ? quote.simulation.gasUsed?.toString() : "N/A",
        })),
      );
    }

    if (failed.length > 0) {
      console.log("\nFailed simulations:");
      for (const quote of failed) {
        console.log(
          `\n${quote.provider} simulation failed: ${quote.simulation.success ? "" : quote.simulation.error}`,
        );
      }
    }

    expect(successful.length).toBeGreaterThan(0);

    for (const quote of successful) {
      expect(quote.simulation).toBeDefined();
      expect(typeof quote.simulation.success).toBe("boolean");

      if (quote.simulation.success) {
        expect(quote.simulation.outputAmount).toBeDefined();
        expect(typeof quote.simulation.outputAmount).toBe("bigint");
        expect(quote.simulation.callsResults.length).toBe(3); // approve, swap, balance
        expect(quote.simulation.callsResults.every((res) => res.status === "success")).toBe(true);
        expect(quote.simulation.gasUsed).toBeDefined();

        const tolerance = (quote.outputAmount * 5000n) / 10000n; // output within 50%
        expect(quote.simulation.outputAmount).toBeGreaterThanOrEqual(
          quote.outputAmount - tolerance,
        );
        expect(quote.simulation.outputAmount).toBeLessThanOrEqual(quote.outputAmount + tolerance);
      }
    }
  }, 30000);
});
