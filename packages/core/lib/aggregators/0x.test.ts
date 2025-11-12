import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils.js";
import { ZeroXAggregator } from "./0x.js";

describe("0x API test", () => {
  it("generates a quote", async () => {
    const quoter = new ZeroXAggregator({
      apiKey: process.env.ZEROX_API_KEY || "",
    });
    const quote = await quoter.fetchQuote(defaultSwapParams);

    expect(quote).toBeDefined();
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.networkFee).toBeGreaterThan(0n);
    expect(quote.txData).toBeDefined();
    expect(quote.txData.data).toBeDefined();
    expect(quote.txData.to).toBeDefined();
  }, 30_000);
});
