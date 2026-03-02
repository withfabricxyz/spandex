import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  nativeInputSwap,
  nativeOutputSwap,
  recordOutput,
} from "../../test/utils.js";
import { LifiAggregator, lifi } from "./lifi.js";

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

  it("supports native in", async () => {
    const quote = await recordOutput("lifi/native-input", async () => {
      return lifi().fetchQuote(nativeInputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "lifi") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);

  it("supports native out", async () => {
    const quote = await recordOutput("lifi/native-output", async () => {
      return lifi().fetchQuote(nativeOutputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "lifi") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);
});
