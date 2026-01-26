import { describe, expect, it } from "bun:test";
import { defaultSwapParams, testConfig } from "packages/core/test/utils.js";
import { fabric } from "../aggregators/fabric.js";
import { kyberswap } from "../aggregators/kyber.js";
import { prepareQuotes } from "../prepareQuotes.js";
import { decodeQuoteStream, newQuoteStream } from "./streams.js";

describe("streaming", () => {
  it("properly streams serialized quotes", async () => {
    const quotes = await prepareQuotes({
      swap: defaultSwapParams,
      config: testConfig([
        fabric({ appId: "test-fabric-key" }),
        kyberswap({ clientId: "test-kyberswap-key" }),
      ]),
      mapFn: async (quote) => {
        return quote;
      },
    });

    const stream = newQuoteStream(quotes);
    const decodedPromises = await decodeQuoteStream(stream);
    const decoded = await Promise.all(decodedPromises);
    expect(decoded.length).toBe(quotes.length);
    expect(decoded.find((q) => q.provider === "fabric")).toBeDefined();
    expect(decoded.find((q) => q.provider === "kyberswap")).toBeDefined();
    expect(decoded.find((q) => q.success)).toBeDefined();
  }, 10_000);
});
