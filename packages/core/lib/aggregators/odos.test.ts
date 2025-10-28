import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils";
import { OdosAggregator, odosRouteGraph } from "./odos";

describe("Odos", () => {
  it("generates a quote", async () => {
    const quoter = new OdosAggregator();
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.networkFee).toBeGreaterThan(0n);
    expect(quote.txData).toBeDefined();
    expect(quote.txData.to).toBeDefined();
    expect(quote.txData.data).toBeDefined();
  }, 30_000);

  it("generates a route graph from pathViz", async () => {
    const mockPathViz = {
      nodes: [
        {
          address: defaultSwapParams.inputToken,
          symbol: "USDC",
          decimals: 6,
        },
        {
          address: defaultSwapParams.outputToken,
          symbol: "WETH",
          decimals: 18,
        },
      ],
      edges: [
        {
          source: defaultSwapParams.inputToken,
          target: defaultSwapParams.outputToken,
          pool: "0x3041CbD36888bECc7bbCBc0045E3B1f144466f5f",
          value: "1000000",
        },
      ],
    };

    const graph = odosRouteGraph(mockPathViz);
    expect(graph).toBeDefined();
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.nodes[0]?.symbol).toBe("USDC");
    expect(graph.edges[0]?.value).toBe(1000000);
  }, 500);
});
