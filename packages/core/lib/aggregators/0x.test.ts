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
    expect(quote.provider).toBe("0x");
    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.networkFee).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.data).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.route).toBeDefined();
      expect(quote.route?.edges?.length).toBeGreaterThan(0);
      expect(quote.route?.nodes?.length).toBeGreaterThan(0);
    }
  }, 30_000);
});
