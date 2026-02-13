import { describe, expect, it } from "bun:test";
import { defaultSwapParams, recordDefaultSimulation } from "../../test/utils.js";
import { FabricAggregator, type FabricQuoteResponse, fabric, fabricRouteGraph } from "./fabric.js";

describe("Fabric Router API test", () => {
  it("provides metadata", () => {
    const aggregator = new FabricAggregator({ appId: "test" });
    expect(aggregator.name()).toBe("fabric");
    expect(aggregator.features()).not.toBeEmpty();
    const metadata = aggregator.metadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("Fabric");
    expect(metadata.url).toMatch(/spandex\.sh/);
    expect(metadata.docsUrl).toMatch(/spandex\.sh/);
  });

  it("generates a quote", async () => {
    const quoter = new FabricAggregator({ appId: "test" });
    const quote = await quoter.fetchQuote(defaultSwapParams, {
      integratorSwapFeeBps: 20,
      integratorFeeAddress: "0xfee000000000000000000000000000000000beef",
    });
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("fabric");
    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.txData.data).toBeDefined();
      expect(quote.route).toBeDefined();
      expect(quote.route?.edges?.length).toBeGreaterThan(0);
      expect(quote.route?.nodes?.length).toBeGreaterThan(0);

      const fee = (quote.details as FabricQuoteResponse).fees.filter(
        (f) => f.recipient === "0xfee000000000000000000000000000000000beef",
      )[0];
      expect(fee).toBeDefined();
      expect(Number(fee?.amount)).toBeGreaterThan(0);
    }
  }, 30_000);

  it("generates a quote for exact out", async () => {
    const quoter = new FabricAggregator({ appId: "test" });
    const quote = await quoter.fetchQuote({
      chainId: 8453,
      inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      outputToken: "0x4200000000000000000000000000000000000006",
      outputAmount: 10n ** 17n,
      slippageBps: 100,
      swapperAccount: "0xdead00000000000000000000000000000000beef",
      mode: "targetOut",
    });
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("fabric");
    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThanOrEqual(10n ** 17n); // TODO
      expect(quote.inputAmount).toBeGreaterThan(0n);
      expect(quote.inputAmount).toBeLessThan(500n * 10n ** 6n); // less than 500 ETH
      expect(quote.txData).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.txData.data).toBeDefined();
      expect(quote.route).toBeDefined();
      expect(quote.route?.edges?.length).toBeGreaterThan(0);
      expect(quote.route?.nodes?.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it("generates a route DAG", async () => {
    const file = await Bun.file(`${import.meta.dir}/../../test/fixtures/fabric/quote1.json`).json();
    const dag = fabricRouteGraph(file);
    expect(dag).toBeDefined();
    expect(dag.nodes.length).toBeGreaterThan(0);
    expect(dag.edges.length).toBeGreaterThan(0);
  }, 500);

  it("simulates a swap - recorded", async () => {
    const quote = await recordDefaultSimulation(fabric({ appId: "test" }));
    expect(quote).toBeDefined();
    expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
    expect(quote.simulation.gasUsed).toBeGreaterThan(0);
    expect(quote.simulation.latency).toBeGreaterThan(0);
    expect(quote.performance.accuracy).toBe(0);
  }, 30_000);
});
