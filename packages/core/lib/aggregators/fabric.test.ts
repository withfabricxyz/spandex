import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils";
import { FabricAggregator, fabricRouteGraph } from "./fabric";

describe("Fabric Router API test", () => {
  it("generates a quote", async () => {
    const quoter = new FabricAggregator({
      // url: "https://booda.defi.withfabric.xyz",
      url: "http://localhost:8000",
    });
    const quote = await quoter.fetchQuote(defaultSwapParams);
    console.log(quote.route);
    expect(quote).toBeDefined();
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.txData).toBeDefined();
    expect(quote.txData.to).toBeDefined();
    expect(quote.txData.data).toBeDefined();
  }, 30_000);

  it("generates a route DAG", async () => {
    const file = await Bun.file(`${import.meta.dir}/../../test/fixtures/fabric/quote1.json`).json();
    const dag = fabricRouteGraph(file);
    expect(dag).toBeDefined();
    expect(dag.nodes.length).toBeGreaterThan(0);
    expect(dag.edges.length).toBeGreaterThan(0);
  }, 500);
});
