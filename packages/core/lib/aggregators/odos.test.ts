import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils.js";
import { QuoteError, type SwapParams } from "../types.js";
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

  it("warns on construction", () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      odos();
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.[0]).toMatch(/Odos provider is deprecated/);
    expect(warnings[0]?.[0]).toMatch(/Remove odos\(\)/);
  });

  it("always returns a failed quote immediately without making a request", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      throw new Error("Odos should not make a request");
    }) as typeof fetch;

    const requests: SwapParams[] = [
      defaultSwapParams,
      {
        chainId: defaultSwapParams.chainId,
        inputToken: defaultSwapParams.inputToken,
        outputToken: defaultSwapParams.outputToken,
        slippageBps: defaultSwapParams.slippageBps,
        swapperAccount: defaultSwapParams.swapperAccount,
        mode: "targetOut",
        outputAmount: 1n,
      },
    ];
    const quoter = new OdosAggregator({ attributes: { legacy: true } });

    try {
      for (const request of requests) {
        const pendingQuote = quoter.fetchQuote(request, {
          deadlineMs: 120_000,
          initialRetryDelayMs: 10_000,
          numRetries: 10,
        });
        let settled = false;
        pendingQuote.then(() => {
          settled = true;
        });
        await Promise.resolve();

        expect(settled).toBe(true);
        const quote = await pendingQuote;
        expect(quote.success).toBe(false);
        expect(quote.provider).toBe("odos");
        expect(quote.providerAttributes).toEqual({ legacy: true });
        expect(quote.error).toBeInstanceOf(QuoteError);
        expect(quote.error?.message).toMatch(/Odos provider is deprecated/);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchCalls).toBe(0);
  });
});
