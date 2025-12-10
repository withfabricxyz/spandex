import { describe, expect, it } from "bun:test";
import { defaultSwapParams, MockAggregator, quoteSuccess } from "../test/utils.js";
import type { Config } from "./createConfig.js";
import { getQuote } from "./getQuote.js";

describe("meta aggregator", () => {
  it("uses quoted price strategy", async () => {
    const config: Config = {
      aggregators: [
        new MockAggregator(quoteSuccess),
        new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
      ],
      params: {
        providers: {},
      },
    };

    const best = await getQuote({
      config,
      params: defaultSwapParams,
      strategy: "quotedPrice",
    });
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_001n);
  });

  it("switches strategies per request", async () => {
    const config: Config = {
      aggregators: [
        new MockAggregator({ ...quoteSuccess, networkFee: 1_000n }),
        new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
      ],
      params: {
        providers: {},
      },
    };

    let best = await getQuote({ config, params: defaultSwapParams, strategy: "quotedGas" });
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_000n);
    best = await getQuote({ config, params: defaultSwapParams, strategy: "quotedPrice" });
    expect(best).toBeDefined();
    expect(best?.outputAmount).toBe(900_001n);
  });
});
