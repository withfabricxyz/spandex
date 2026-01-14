import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils.js";
import { LifiAggregator } from "./lifi.js";

describe("LiFi API test", () => {
  it("provides metadata", () => {
    const aggregator = new LifiAggregator({});
    expect(aggregator.name()).toBe("lifi");
    expect(aggregator.features()).not.toBeEmpty();
    const metadata = aggregator.metadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("LI.FI");
    expect(metadata.url).toMatch(/li\.fi/);
    expect(metadata.docsUrl).toMatch(/li\.fi/);
  });

  it("generates a quote", async () => {
    const quoter = new LifiAggregator({});
    const quote = await quoter.fetchQuote(defaultSwapParams);

    expect(quote).toBeDefined();
    expect(quote.provider).toBe("lifi");
    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.networkFee).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.data).toBeDefined();
      expect(quote.txData.to).toBeDefined();
    }
  }, 30_000);
});
