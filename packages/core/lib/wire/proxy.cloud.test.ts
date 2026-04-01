import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { usdcBalanceSwap } from "../../test/utils.js";
import type { FabricQuoteResponse } from "../aggregators/fabric.js";
import type { Quote, SimulatedQuote, SimulationSuccess } from "../types.js";
import { spandexCloud } from "./proxy.js";
import { newStream, quoteStreamErrorHandler, simulatedQuoteStreamErrorHandler } from "./streams.js";

const quote: Extract<Quote, { provider: "fabric" }> = {
  success: true,
  provider: "fabric",
  details: {} as FabricQuoteResponse,
  latency: 0,
  inputChainId: 8453,
  outputChainId: 8453,
  execution: "atomic",
  inputAmount: 1_000_000n,
  outputAmount: 900_000n,
  networkFee: 1n,
  txData: { to: "0x0000000000000000000000000000000000000001", data: "0x" },
};

const simulatedQuote: Extract<SimulatedQuote, { provider: "fabric"; success: true }> = {
  ...quote,
  simulation: {
    success: true,
    outputAmount: 900_000n,
    swapResult: {} as SimulationSuccess["swapResult"],
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
};

describe("spandexCloud", () => {
  const cloud = spandexCloud({ apiKey: "testing" });
  let originalFetch: typeof fetch;
  let requests: Request[];
  let responses: Response[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    requests = [];
    responses = [];
    globalThis.fetch = (async (input: string | Request | URL, init?: RequestInit) => {
      requests.push(new Request(input.toString(), init));
      return responses.shift() ?? new Response(null, { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("consumes streamed quote responses from cloud", async () => {
    responses.push(
      new Response(newStream<Quote>([Promise.resolve(quote)], quoteStreamErrorHandler), {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );

    const quotes = await Promise.all(await cloud.prepareQuotes(usdcBalanceSwap));

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.provider).toBe("fabric");
    expect(new URL(requests[0]?.url || "").pathname).toBe("/api/v1/prepareQuotes");
    expect(requests[0]?.headers.get("X-Api-Key")).toBe("testing");
  });

  it("consumes streamed simulated quote responses from cloud", async () => {
    responses.push(
      new Response(
        newStream<SimulatedQuote>(
          [Promise.resolve(simulatedQuote)],
          simulatedQuoteStreamErrorHandler,
        ),
        {
          headers: { "Content-Type": "application/octet-stream" },
        },
      ),
    );

    const quotes = await Promise.all(await cloud.prepareSimulatedQuotes(usdcBalanceSwap));

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.simulation.success).toBe(true);
    expect(new URL(requests[0]?.url || "").pathname).toBe("/api/v1/prepareSimulatedQuotes");
    expect(requests[0]?.headers.get("X-Api-Key")).toBe("testing");
  });
});
