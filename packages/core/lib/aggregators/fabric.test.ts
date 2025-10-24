import { describe, expect, it } from "bun:test";
import { FabricAggregator } from "./fabric";
import { baseClient, defaultSwapParams } from "../../test/utils";

describe("Fabric Router API test", () => {
  it("generates a quote", async () => {
    const quoter = new FabricAggregator({
      url: "https://booda.defi.withfabric.xyz",
    });
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.txData).toBeDefined();
    expect(quote.txData.to).toBeDefined();
    expect(quote.txData.data).toBeDefined();
  }, 30_000);
});
