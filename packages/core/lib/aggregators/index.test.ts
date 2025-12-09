import { describe, expect, it } from "bun:test";
import { defaultSwapParams, MockAggregator, quoteFailure } from "../../test/utils.js";
import type { FailedQuote } from "../types.js";
import { deadline } from "./index.js";

describe("aggregator", () => {
  it("provides basic data", async () => {
    const mock = new MockAggregator(quoteFailure);
    expect(mock.name()).toBe("fabric");
    expect(mock.features()).toEqual(["exactIn"]);
  }, 1000);

  it("triggers a deadline", async () => {
    const error = await deadline({ deadlineMs: 5, aggregator: "fabric" });
    expect(error).toBeDefined();
    expect(error.success).toBe(false);
    expect((error as FailedQuote).error?.message).toMatch(/Aggregator deadline exceeded/);
  }, 1000);

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

  it("respects the deadline", async () => {
    const mock = new MockAggregator(quoteFailure, { delay: 200 });
    const start = Date.now();
    const quote = await mock.fetchQuote(defaultSwapParams, {
      deadlineMs: 10,
    });
    const end = Date.now();
    expect(quote).toBeDefined();
    expect(end - start).toBeGreaterThanOrEqual(10); // 50ms deadline
    expect(end - start).toBeLessThanOrEqual(20);
    expect(mock.count).toBe(1); // Retry should be skipped due to deadline
    expect(quote.success).toBe(false);
    expect((quote as FailedQuote).error?.message).toMatch(/Aggregator deadline exceeded/);
  }, 500);
});
