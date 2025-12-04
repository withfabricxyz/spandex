import { describe, expect, it } from "bun:test";
import type { FabricQuoteResponse } from "./aggregators/fabric.js";
import { applyStrategy } from "./strategies.js";
import type { Quote, SuccessfulQuote } from "./types.js";

const quoteSuccess: Quote = {
  success: true,
  provider: "fabric",
  details: {} as FabricQuoteResponse,
  latency: 100,
  inputAmount: 1_000_000n,
  outputAmount: 900_000n,
  networkFee: 5_000n,
  txData: { to: "0x0", data: "0x0" },
};

const quoteFailure: Quote = {
  success: false,
  provider: "fabric",
  error: new Error("Failed to get quote"),
};

describe("strategies", () => {
  it("picks the fastest successful response", async () => {
    const pending = [
      new Promise<Quote>((resolve) => {
        setTimeout(() => {
          resolve(quoteSuccess);
        }, 200);
      }),
      new Promise<Quote>((resolve) => {
        setTimeout(() => {
          resolve({ ...quoteSuccess, outputAmount: 7457n });
        }, 150);
      }),
      new Promise<Quote>((resolve) => {
        setTimeout(() => {
          resolve(quoteFailure);
        }, 10);
      }),
    ];

    const output = await applyStrategy("fastest", pending);
    expect(output).toBeDefined();
    expect(output?.outputAmount).toBe(7457n);
  }, 1_000);

  it("price selection - best outut relative to input is chosen", async () => {
    const pending = [
      new Promise<Quote>((resolve) => {
        resolve(quoteFailure);
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, outputAmount: 13n });
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, outputAmount: 15n });
      }),
    ];
    const output = await applyStrategy("quotedPrice", pending);
    expect(output).toBeDefined();
    expect(output?.outputAmount).toBe(15n);
  }, 1_000);

  it("gas optimized - selects the cheapest in terms of gas", async () => {
    const pending = [
      new Promise<Quote>((resolve) => {
        resolve(quoteFailure);
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, networkFee: 1500000000n });
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, networkFee: 1300000n });
      }),
    ];
    const output = await applyStrategy("quotedGas", pending);
    expect(output).toBeDefined();
    expect(output?.networkFee).toBe(1300000n);
  }, 1_000);

  it("priority selection (used for failover)", async () => {
    const pending = [
      new Promise<Quote>((resolve) => {
        resolve(quoteFailure);
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, outputAmount: 15n });
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, outputAmount: 30n });
      }),
    ];
    const output = await applyStrategy("priority", pending);
    expect(output).toBeDefined();
    expect(output?.outputAmount).toBe(15n);
  }, 1_000);

  it("custom selection", async () => {
    const pending = [
      new Promise<Quote>((resolve) => {
        resolve(quoteFailure);
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, outputAmount: 15n });
      }),
      new Promise<Quote>((resolve) => {
        resolve({ ...quoteSuccess, outputAmount: 30n });
      }),
    ];
    const output = await applyStrategy((quotes) => {
      return Promise.all(quotes).then((resolved) => resolved[2] as SuccessfulQuote);
    }, pending);
    expect(output).toBeDefined();
    expect(output?.outputAmount).toBe(30n);
  }, 1_000);

  it("returns null if no successful quotes", async () => {
    const pending = [
      new Promise<Quote>((resolve) => {
        resolve(quoteFailure);
      }),
      new Promise<Quote>((resolve) => {
        resolve(quoteFailure);
      }),
    ];
    const output = await applyStrategy("quotedPrice", pending);
    expect(output).toBeNull();
  });

  it("throws if args are bad", async () => {
    await expect(applyStrategy("quotedPrice", [])).rejects.toThrow();
  });
});
