import { describe, expect, it } from "bun:test";
import { defaultSwapParams, MockAggregator } from "../test/utils.ts";
import { MetaAggregator } from "./aggregator.js";
import type { FabricQuoteResponse } from "./aggregators/fabric.js";
import type { Quote, QuoteError } from "./types.js";

const quoteSuccess: Quote = {
  success: true,
  provider: "fabric",
  details: {} as FabricQuoteResponse,
  latency: 100,
  outputAmount: 900_000n,
  networkFee: 5_000n,
  txData: { to: "0x0", data: "0x0" },
};

const quoteFailure: Quote = {
  success: false,
  provider: "fabric",
  message: "Failed to get quote",
};

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
    const quotes = await Promise.all(quoter.prepareQuotes(defaultSwapParams));
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
    const quotes = await quoter.fetchQuotes(defaultSwapParams);
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
  });

  it("uses default strategy", async () => {
    const quoter = new MetaAggregator([
      new MockAggregator(quoteSuccess),
      new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
    ]);
    const best = await quoter.fetchBestQuote(defaultSwapParams);
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_001n);
  });

  it("overrides properly - class to request", async () => {
    const quoter = new MetaAggregator(
      [
        new MockAggregator({ ...quoteSuccess, networkFee: 1_000n }),
        new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
      ],
      {
        strategy: "quotedGas",
      },
    );
    let best = await quoter.fetchBestQuote(defaultSwapParams);
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_000n);
    best = await quoter.fetchBestQuote(defaultSwapParams, {
      strategy: "quotedPrice",
    });
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
    const quotes = await quoter.fetchQuotes(defaultSwapParams);
    const end = Date.now();
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(0);
    expect(failingAggregator.count).toBe(4); // 1 initial try + 3 retries
    expect(end - start).toBeGreaterThanOrEqual(5 + 10 + 20); // 5 + 10 ms delays
  }, 10_000);

  it("respects the deadline", async () => {
    const failingAggregator = new MockAggregator(quoteFailure, 200);
    const quoter = new MetaAggregator([failingAggregator], {
      numRetries: 1,
      deadlineMs: 50,
    });
    const start = Date.now();
    const quotes = await quoter.fetchAllQuotes(defaultSwapParams);
    const end = Date.now();
    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
    expect(failingAggregator.count).toBe(1); // 1 initial try + 3 retries
    expect(end - start).toBeGreaterThanOrEqual(50); // 5 + 10 ms delays
    expect(quotes[0]?.success).toBe(false);
    expect((quotes[0] as unknown as QuoteError).message).toMatch(
      /MetaAggregator deadline exceeded/,
    );
  }, 10_000);
});
