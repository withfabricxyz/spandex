import { describe, expect, it } from "bun:test";
import { KyberAggregator } from "./kyber";
import { defaultSwapParams } from "../../test/utils";

describe("Kyberwap", () => {
  it("generates a quote (legacy)", async () => {
    const quoter = new KyberAggregator();
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.networkFee).toBeGreaterThan(0n);
    expect(quote.txData).toBeDefined();
    expect(quote.txData.to).toBeDefined();
    expect(quote.txData.data).toBeDefined();
  }, 30_000);
});
