import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils.js";
import { RelayAggregator } from "./relay.js";

describe("Relay", () => {
  it("generates a quote", async () => {
    const quoter = new RelayAggregator();
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("relay");

    if (quote.provider !== "relay") {
      throw new Error("Unexpected provider");
    }

    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.networkFee).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.txData.data).toBeDefined();
    }
  }, 30_000);
});
