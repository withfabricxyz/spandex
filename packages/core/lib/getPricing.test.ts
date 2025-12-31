import { describe, expect, it } from "bun:test";
import { getPricing } from "./getPricing.js";
import type { SuccessfulQuote } from "./types.js";

const baseQuote: SuccessfulQuote = {
  success: true,
  provider: "fabric",
  details: {} as never,
  latency: 1,
  inputAmount: 1_000_000n,
  outputAmount: 2_000_000_000_000_000_000n,
  networkFee: 0n,
  txData: {
    to: "0x0000000000000000000000000000000000000001",
    data: "0xdeadbeef",
  },
};

describe("getPricing", () => {
  it("averages usd prices across quotes", () => {
    const quoteA: SuccessfulQuote = {
      ...baseQuote,
      provider: "fabric",
      pricing: {
        inputToken: {
          address: "0x00000000000000000000000000000000000000aa",
          decimals: 6,
          usdPrice: 2,
        },
        outputToken: {
          address: "0x00000000000000000000000000000000000000bb",
          decimals: 18,
          usdPrice: 5,
        },
      },
    };

    const quoteB: SuccessfulQuote = {
      ...baseQuote,
      provider: "kyberswap",
      pricing: {
        inputToken: {
          address: "0x00000000000000000000000000000000000000aa",
          decimals: 6,
          usdPrice: 4,
        },
        outputToken: {
          address: "0x00000000000000000000000000000000000000bb",
          decimals: 18,
          usdPrice: 6,
        },
      },
    };

    const summary = getPricing([quoteA, quoteB]);

    expect(summary.inputToken?.usdPrice).toBeCloseTo(3);
    expect(summary.outputToken?.usdPrice).toBeCloseTo(5.5);
    expect(summary.sources.sort()).toEqual(["fabric", "kyberswap"]);
  });
});
