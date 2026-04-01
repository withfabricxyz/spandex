import { describe, expect, it } from "bun:test";
import type { FabricQuoteResponse } from "./aggregators/fabric.js";
import type { KyberQuoteResponse } from "./aggregators/kyber.js";
import { getPricing } from "./getPricing.js";
import type { SuccessfulQuote } from "./types.js";

type FabricSuccessfulQuote = Extract<SuccessfulQuote, { provider: "fabric" }>;
type KyberSuccessfulQuote = Extract<SuccessfulQuote, { provider: "kyberswap" }>;

const baseQuote: FabricSuccessfulQuote = {
  success: true,
  provider: "fabric",
  details: {} as FabricQuoteResponse,
  latency: 1,
  inputChainId: 8453,
  outputChainId: 8453,
  execution: "atomic",
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
    const quoteA: FabricSuccessfulQuote = {
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

    const quoteB: KyberSuccessfulQuote = {
      ...baseQuote,
      provider: "kyberswap",
      details: {} as KyberQuoteResponse,
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
