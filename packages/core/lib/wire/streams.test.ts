import { describe, expect, it } from "bun:test";
import { defaultSwapParams, testConfig } from "packages/core/test/utils.js";
import { fabric } from "../aggregators/fabric.js";
import { relay } from "../aggregators/relay.js";
import { prepareQuotes } from "../prepareQuotes.js";
import type { Quote, SimulatedQuote } from "../types.js";
import {
  decodeStream,
  newStream,
  quoteStreamErrorHandler,
  simulatedQuoteStreamErrorHandler,
} from "./streams.js";

const simulatedQuote: SimulatedQuote = {
  success: true,
  provider: "fabric",
  details: {},
  latency: 0,
  inputAmount: 1_000_000n,
  outputAmount: 900_000n,
  networkFee: 1n,
  txData: { to: "0x0000000000000000000000000000000000000001", data: "0x" },
  simulation: {
    success: true,
    outputAmount: 900_000n,
    swapResult: { status: "success" },
    latency: 0,
    gasUsed: 1n,
    blockNumber: 1n,
  },
  performance: {
    latency: 0,
    gasUsed: 1n,
    outputAmount: 900_000n,
    priceDelta: 0,
    accuracy: 0,
  },
} as SimulatedQuote;

describe("streaming", () => {
  it("properly streams serialized quotes", async () => {
    const quotes = await prepareQuotes({
      swap: defaultSwapParams,
      config: testConfig([fabric({ appId: "test-fabric-key" }), relay({})]),
      mapFn: async (quote) => {
        return quote;
      },
    });

    const stream = newStream<Quote>(quotes, quoteStreamErrorHandler);
    const decodedPromises = await decodeStream<Quote>(stream);
    const decoded = await Promise.all(decodedPromises);
    expect(decoded.length).toBe(quotes.length);
    expect(decoded.find((q) => q.provider === "fabric")).toBeDefined();
    expect(decoded.find((q) => q.provider === "relay")).toBeDefined();
    expect(decoded.every((q) => typeof q.success === "boolean")).toBe(true);
  }, 10_000);

  it("properly streams serialized simulated quotes", async () => {
    const stream = newStream<SimulatedQuote>(
      [Promise.resolve(simulatedQuote)],
      simulatedQuoteStreamErrorHandler,
    );
    const decodedPromises = await decodeStream<SimulatedQuote>(stream);
    const decoded = await Promise.all(decodedPromises);
    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.simulation.success).toBe(true);
  });

  it("supports generic stream helpers", async () => {
    const stream = newStream<SimulatedQuote>(
      [Promise.resolve(simulatedQuote)],
      simulatedQuoteStreamErrorHandler,
    );
    const decodedPromises = await decodeStream<SimulatedQuote>(stream);
    const decoded = await Promise.all(decodedPromises);
    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.provider).toBe("fabric");
  });
});
