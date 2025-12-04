import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils.js";
import { KyberAggregator, kyberRouteGraph } from "./kyber.js";

describe("Kyberwap", () => {
  it("provides metadata", () => {
    const aggregator = new KyberAggregator();
    expect(aggregator.name()).toBe("kyberswap");
    expect(aggregator.features()).not.toBeEmpty();
    const metadata = aggregator.metadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("KyberSwap");
    expect(metadata.url).toMatch(/kyber/);
    expect(metadata.docsUrl).toMatch(/kyber/);
  });

  it("generates a quote (legacy)", async () => {
    const quoter = new KyberAggregator();
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("kyberswap");
    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.networkFee).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.txData.data).toBeDefined();
      expect(quote.route).toBeDefined();
      expect(quote.route?.edges?.length).toBeGreaterThan(0);
      expect(quote.route?.nodes?.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it("generates a route DAG", async () => {
    const file = await Bun.file(`${import.meta.dir}/../../test/fixtures/kyber1.json`).json();
    const dag = kyberRouteGraph(file);
    expect(dag).toBeDefined();
    expect(dag.nodes.length).toBeGreaterThan(0);
    expect(dag.edges.length).toBeGreaterThan(0);
  }, 500);
});
