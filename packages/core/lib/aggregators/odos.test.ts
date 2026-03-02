import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  nativeInputSwap,
  nativeOutputSwap,
  recordOutput,
} from "../../test/utils.js";
import { OdosAggregator, odos } from "./odos.js";

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

  it("supports native in", async () => {
    const quote = await recordOutput("odos/native-input", async () => {
      return odos().fetchQuote(nativeInputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "odos") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);

  it("supports native out", async () => {
    const quote = await recordOutput("odos/native-output", async () => {
      return odos().fetchQuote(nativeOutputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "odos") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);
});
