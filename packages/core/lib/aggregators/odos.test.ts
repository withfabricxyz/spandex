import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils.js";
import { OdosAggregator } from "./odos.js";

describe("Odos", () => {
  it("provides metadata", () => {
    const aggregator = new OdosAggregator();
    expect(aggregator.name()).toBe("odos");
    expect(aggregator.features()).not.toBeEmpty();
    const metadata = aggregator.metadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("Odos");
    expect(metadata.url).toMatch(/odos/);
    expect(metadata.docsUrl).toMatch(/odos/);
  });

  it("generates a quote", async () => {
    const quoter = new OdosAggregator();
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("odos");
    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.networkFee).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.txData.data).toBeDefined();
    }
  }, 30_000);
});
