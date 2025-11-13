import { describe, expect, it } from "bun:test";
import { defaultSwapParams, MockAggregator, quoteFailure } from "../test/utils.js";

describe("aggregator", () => {
  it("retries failed quotes", async () => {
    const mock = new MockAggregator(quoteFailure);
    const start = Date.now();
    const quote = await mock.fetchQuote(defaultSwapParams, {
      numRetries: 3,
      initialRetryDelayMs: 5,
    });
    const end = Date.now();
    expect(quote).toBeDefined();
    expect(mock.count).toBe(4); // 1 initial try + 3 retries
    expect(end - start).toBeGreaterThanOrEqual(5 + 10 + 20); // 5 + 10 ms delays
  }, 10_000);
});
