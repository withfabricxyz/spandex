import { describe, expect, it } from "bun:test";
import { defaultSwapParams, MockAggregator, quoteFailure, quoteSuccess } from "../test/utils.js";
import { MetaAggregator } from "./meta_aggregator.js";
import type { FailedQuote, Quote } from "./types.js";

describe("aggregator", () => {
  it("throws on misconfiguration", async () => {
    expect(() => new MetaAggregator([])).toThrow();
  });

  it("produces outputs", async () => {
    const quoter = new MetaAggregator(
      [new MockAggregator(quoteSuccess), new MockAggregator(quoteFailure)],
      {
        numRetries: 0,
      },
    );
    const quotes = await quoter.fetchQuotes(defaultSwapParams);
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(2);
    expect(quotes[0]?.success).toBe(true);
    expect(quotes[1]?.success).toBe(false);
  });

  it("produces only successful outcomes", async () => {
    const quoter = new MetaAggregator(
      [new MockAggregator(quoteSuccess), new MockAggregator(quoteFailure)],
      {
        numRetries: 0,
      },
    );
    const quotes = await quoter.fetchSuccessfulQuotes(defaultSwapParams);
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
  });

  it("uses quoted price strategy", async () => {
    const quoter = new MetaAggregator([
      new MockAggregator(quoteSuccess),
      new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
    ]);
    const best = await quoter.fetchBestQuote(defaultSwapParams, { strategy: "quotedPrice" });
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_001n);
  });

  it("switches strategies per request", async () => {
    const quoter = new MetaAggregator([
      new MockAggregator({ ...quoteSuccess, networkFee: 1_000n }),
      new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
    ]);
    let best = await quoter.fetchBestQuote(defaultSwapParams, { strategy: "quotedGas" });
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_000n);
    best = await quoter.fetchBestQuote(defaultSwapParams, { strategy: "quotedPrice" });
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_001n);
  });

  it("retries failed quotes", async () => {
    const failingAggregator = new MockAggregator(quoteFailure);
    const quoter = new MetaAggregator([failingAggregator], {
      numRetries: 3,
      initialRetryDelayMs: 5,
    });
    const start = Date.now();
    const quotes = await quoter.fetchSuccessfulQuotes(defaultSwapParams);
    const end = Date.now();
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(0);
    expect(failingAggregator.count).toBe(4); // 1 initial try + 3 retries
    expect(end - start).toBeGreaterThanOrEqual(5 + 10 + 20); // 5 + 10 ms delays
  }, 10_000);

  it("respects the deadline", async () => {
    const failingAggregator = new MockAggregator(quoteFailure, { delay: 200 });
    const quoter = new MetaAggregator([failingAggregator], {
      numRetries: 1,
      deadlineMs: 50,
    });
    const start = Date.now();
    const quotes = await quoter.fetchQuotes(defaultSwapParams);
    const end = Date.now();
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
    expect(end - start).toBeGreaterThanOrEqual(50); // 50ms deadline
    expect(end - start).toBeLessThanOrEqual(75); // 50% buffer
    expect(failingAggregator.count).toBe(1); // Retry should be skipped due to deadline
    expect(quotes[0]?.success).toBe(false);
    expect((quotes[0] as FailedQuote).error?.message).toMatch(/Aggregator deadline exceeded/);
  }, 10_000);

  it("respects target out filter", async () => {
    const quoter = new MetaAggregator([
      new MockAggregator(quoteSuccess, { features: ["targetOut"] }),
      new MockAggregator(quoteSuccess),
    ]);
    const quotes = await quoter.fetchQuotes({
      ...defaultSwapParams,
      mode: "targetOut",
      outputAmount: 1_000_000n,
    });
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
  }, 1_000);

  it("respects surplus taking filter", async () => {
    const quoter = new MetaAggregator(
      [
        new MockAggregator(quoteSuccess, { features: ["exactIn", "integratorSurplus"] }),
        new MockAggregator(quoteSuccess),
      ],
      {
        integratorSurplusBps: 10,
        integratorFeeAddress: "0x0000000000000000000000000000000000000001" as `0x${string}`,
      },
    );
    const quotes = await quoter.fetchQuotes(defaultSwapParams);
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
  }, 1_000);

  it("clones with new options", async () => {
    const agg = new MetaAggregator(
      [
        new MockAggregator(quoteSuccess, { features: ["exactIn", "integratorSurplus"] }),
        new MockAggregator(quoteSuccess),
      ],
      {
        integratorSurplusBps: 10,
        integratorFeeAddress: "0x0000000000000000000000000000000000000001" as `0x${string}`,
      },
    );
    const clone = agg.clone({
      integratorSurplusBps: 20,
      deadlineMs: 1337,
    });
    expect(clone).toBeInstanceOf(MetaAggregator);
    expect(clone === agg).toBe(false);
    expect(clone.options.integratorSurplusBps).toBe(20);
    expect(clone.options.integratorFeeAddress).toBe("0x0000000000000000000000000000000000000001");
    expect(clone.options.deadlineMs).toBe(1337);
  }, 1_000);

  it("maps quotes when requested", async () => {
    const agg = new MetaAggregator([new MockAggregator(quoteSuccess)]);
    const success = await agg.fetchAndThen({
      params: defaultSwapParams,
      mapFn: async (quote: Quote) => quote.success,
    });

    expect(success.length).toBe(1);
    expect(success[0]).toBe(true);
  }, 1_000);
});
