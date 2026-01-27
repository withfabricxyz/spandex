import { describe, expect, it } from "bun:test";
import { recordOutput, testConfig, usdcBalanceSwap } from "packages/core/test/utils.js";
import { fabric } from "../aggregators/fabric.js";
import { kyberswap } from "../aggregators/kyber.js";
import { odos } from "../aggregators/odos.js";
import { getQuotes } from "../getQuotes.js";
import type { SuccessfulSimulatedQuote } from "../types.js";
import { sortQuotesByPerformance } from "./performance.js";

describe("performance", () => {
  it("tracks perf and sorts properly", async () => {
    const { result: quotes } = await recordOutput("perf-sorting", async () => {
      return getQuotes({
        config: testConfig([
          fabric({ appId: "spandex" }),
          kyberswap({ clientId: "spandex-2" }),
          odos({}),
        ]),
        swap: usdcBalanceSwap,
      }).then((result) => {
        return result.filter((q) => q.simulation.success) as SuccessfulSimulatedQuote[];
      });
    });
    expect(quotes).toBeDefined();
    expect(quotes.length).toBeGreaterThan(1);

    for (const quote of quotes) {
      console.log(quote.provider, quote.performance);
    }

    expect(
      sortQuotesByPerformance({ quotes, metric: "latency", ascending: false })[0]?.provider,
    ).toBe("kyberswap");
    expect(
      sortQuotesByPerformance({ quotes, metric: "latency", ascending: true })[0]?.provider,
    ).toBe("fabric");
    expect(
      sortQuotesByPerformance({ quotes, metric: "gasUsed", ascending: true })[0]?.provider,
    ).toBe("fabric");
    expect(
      sortQuotesByPerformance({ quotes, metric: "gasUsed", ascending: false })[0]?.provider,
    ).toBe("kyberswap");
    expect(
      sortQuotesByPerformance({ quotes, metric: "outputAmount", ascending: true })[0]?.provider,
    ).toBe("kyberswap");
    expect(
      sortQuotesByPerformance({ quotes, metric: "outputAmount", ascending: false })[0]?.provider,
    ).toBe("fabric");
    expect(
      sortQuotesByPerformance({ quotes, metric: "accuracy", ascending: false })[0]?.provider,
    ).toBe("kyberswap");
  }, 30000);
});
