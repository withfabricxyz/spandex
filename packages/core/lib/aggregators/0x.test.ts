import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  nativeInputSwap,
  nativeOutputSwap,
  recordOutput,
} from "../../test/utils.js";
import { ZeroXAggregator, zeroX } from "./0x.js";

describe("0x API test", () => {
  it("provides metadata", () => {
    const aggregator = new ZeroXAggregator({
      apiKey: "demo",
    });
    expect(aggregator.name()).toBe("0x");
    expect(aggregator.features()).not.toBeEmpty();
    const metadata = aggregator.metadata();
    expect(metadata).toBeDefined();
    expect(metadata.name).toBe("0x");
    expect(metadata.url).toMatch(/0x/);
    expect(metadata.docsUrl).toMatch(/0x/);
  });

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

  it("supports native in", async () => {
    const quote = await recordOutput("0x/native-input", async () => {
      return zeroX({ apiKey: process.env.ZEROX_API_KEY || "" }).fetchQuote(nativeInputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "0x") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);

  it("supports native out", async () => {
    const quote = await recordOutput("0x/native-output", async () => {
      return zeroX({ apiKey: process.env.ZEROX_API_KEY || "" }).fetchQuote(nativeOutputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "0x") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);
});
