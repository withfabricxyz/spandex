import { describe, expect, it } from "bun:test";
import { defaultSwapParams, MockAggregator, quoteFailure, quoteSuccess } from "../test/utils.js";
import type { Config } from "./createConfig.js";
import { getRawQuotes } from "./getRawQuotes.js";
import type { FailedQuote } from "./types.js";

describe("getRawQuotes", () => {
  it("produces outputs", async () => {
    const config: Config = {
      aggregators: [new MockAggregator(quoteSuccess), new MockAggregator(quoteFailure)],
      options: {
        numRetries: 0,
      },
      clientLookup: () => undefined,
    };
    const quotes = await getRawQuotes({ config, swap: defaultSwapParams });
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(2);
    expect(quotes[0]?.success).toBe(true);
    expect(quotes[1]?.success).toBe(false);
  });

  it("retries failed quotes", async () => {
    const failingAggregator = new MockAggregator(quoteFailure);
    const config: Config = {
      aggregators: [failingAggregator],
      options: {
        numRetries: 3,
        initialRetryDelayMs: 5,
      },
      clientLookup: () => undefined,
    };

    const start = Date.now();
    const quotes = await getRawQuotes({ config, swap: defaultSwapParams }).then((qs) =>
      qs.filter((q) => q.success),
    );
    const end = Date.now();
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(0);
    expect(failingAggregator.count).toBe(4); // 1 initial try + 3 retries
    expect(end - start).toBeGreaterThanOrEqual(5 + 10 + 20); // 5 + 10 ms delays
  }, 10_000);

  it("respects the deadline", async () => {
    const failingAggregator = new MockAggregator(quoteFailure, { delay: 200 });
    const config: Config = {
      aggregators: [failingAggregator],
      options: {
        numRetries: 1,
        deadlineMs: 10,
      },
      clientLookup: () => undefined,
    };

    const start = Date.now();
    const quotes = await getRawQuotes({ config, swap: defaultSwapParams });
    const end = Date.now();
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
    expect(end - start).toBeGreaterThanOrEqual(10); // 50ms deadline
    expect(end - start).toBeLessThanOrEqual(100); // 50% buffer
    expect(failingAggregator.count).toBe(1); // Retry should be skipped due to deadline
    expect(quotes[0]?.success).toBe(false);
    expect((quotes[0] as FailedQuote).error?.message).toMatch(/Aggregator deadline exceeded/);
  }, 10_000);

  it("respects target out filter", async () => {
    const config: Config = {
      aggregators: [
        new MockAggregator(quoteSuccess, { features: ["targetOut"] }),
        new MockAggregator(quoteSuccess),
      ],
      options: {},
      clientLookup: () => undefined,
    };

    const quotes = await getRawQuotes({
      config,
      swap: {
        ...defaultSwapParams,
        mode: "targetOut",
        outputAmount: 1_000_000n,
      },
    });
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
  }, 1_000);

  it("respects surplus taking filter", async () => {
    const config: Config = {
      aggregators: [
        new MockAggregator(quoteSuccess, { features: ["exactIn", "integratorSurplus"] }),
        new MockAggregator(quoteSuccess),
      ],
      options: {
        integratorSurplusBps: 10,
        integratorFeeAddress: "0x0000000000000000000000000000000000000001" as `0x${string}`,
      },
      clientLookup: () => undefined,
    };

    const quotes = await getRawQuotes({ config, swap: defaultSwapParams });
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
  }, 1_000);
});
