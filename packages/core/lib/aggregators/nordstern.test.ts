import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  nativeInputSwap,
  nativeOutputSwap,
  recordDefaultSimulation,
  recordOutput,
} from "../../test/utils.js";
import {
  NordsternAggregator,
  type NordsternQuoteResponse,
  nordstern,
  nordsternRouteGraph,
} from "./nordstern.js";

describe("Nordstern", () => {
  it("provides metadata", () => {
    const aggregator = new NordsternAggregator();
    expect(aggregator.name()).toBe("nordstern");
    expect(aggregator.features()).toContain("exactIn");
    const metadata = aggregator.metadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("Nordstern");
    expect(metadata.url).toMatch(/nordstern/);
    expect(metadata.docsUrl).toMatch(/nordstern/);
  });

  it("generates a quote", async () => {
    const quote = await recordOutput("nordstern/default", async () => {
      return nordstern().fetchQuote(defaultSwapParams);
    }).then((r) => r.result);
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("nordstern");
    if (!quote?.success || quote.provider !== "nordstern") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.txData).toBeDefined();
    expect(quote.txData.to).toBeDefined();
    expect(quote.txData.data).toBeDefined();
    expect(quote.route).toBeDefined();
    expect(quote.route?.nodes?.length).toBeGreaterThan(0);
  }, 30_000);

  it("supports native in", async () => {
    const quote = await recordOutput("nordstern/native-input", async () => {
      return nordstern().fetchQuote(nativeInputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "nordstern") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);

  it("supports native out", async () => {
    const quote = await recordOutput("nordstern/native-output", async () => {
      return nordstern().fetchQuote(nativeOutputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "nordstern") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);

  it("simulates", async () => {
    const quote = await recordDefaultSimulation(nordstern());
    expect(quote).toBeDefined();
    console.log(quote.performance);
    expect(quote.simulation.success).toBe(true);
    expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
    expect(quote.simulation.gasUsed).toBeGreaterThan(0);
    expect(quote.simulation.latency).toBeGreaterThan(0);
  }, 30_000);

  it("builds a route DAG", () => {
    const sample: NordsternQuoteResponse = {
      src: "0x4200000000000000000000000000000000000006",
      dst: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      fromAmount: "1000000000000000000",
      toAmount: "4441628141",
      swaps: [
        {
          amountIn: "955740892118787712",
          route: [
            {
              pool: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59",
              tokenIn: "0x4200000000000000000000000000000000000006",
              tokenOut: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            },
          ],
        },
        {
          amountIn: "44259107881212288",
          route: [
            {
              pool: "0x82dbe18346a8656dBB5E76F74bf3AE279cC16B29",
              tokenIn: "0x4200000000000000000000000000000000000006",
              tokenOut: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            },
          ],
        },
      ],
      tx: {
        data: "0xdeadbeef",
        to: "0xC87De04e2EC1F4282dFF2933A2D58199f688fC3d",
        value: "0",
      },
    };

    const dag = nordsternRouteGraph(sample);
    expect(dag.nodes.length).toBe(2);
    expect(dag.edges.length).toBe(2);
    expect(dag.edges[0]?.source).toBe("0x4200000000000000000000000000000000000006");
    expect(dag.edges[0]?.target).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });
});
