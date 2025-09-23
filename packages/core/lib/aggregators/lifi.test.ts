import { describe, expect, it } from "bun:test";
import { LifiAggregator } from "./lifi";
import { defaultSwapParams } from "../../test/utils";

describe("Lifi", () => {
  it("generates a quote", async () => {
    const quoter = new LifiAggregator(); // -1 to prevent prool issues
    const quote = await quoter.fetchQuote(defaultSwapParams);

    expect(quote).toBeDefined();
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.networkFee).toBeGreaterThan(0n);
    expect(quote.txData).toBeDefined();
    expect(quote.txData.to).toBeDefined();
    expect(quote.txData.data).toBeDefined();
  });
});
