import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Address } from "viem";
import { defaultSwapParams, recordedQuotes, testConfig } from "../../test/utils.js";
import type { FabricQuoteResponse } from "../aggregators/fabric.js";
import { fabric } from "../aggregators/fabric.js";
import { createConfig } from "../createConfig.js";
import { getQuote } from "../getQuote.js";
import { getQuotes } from "../getQuotes.js";
import { getRawQuotes } from "../getRawQuotes.js";
import type { Quote, SimulatedQuote, SimulationSuccess, SwapParams } from "../types.js";
import { proxy } from "./proxy.js";
import { newStream, quoteStreamErrorHandler, simulatedQuoteStreamErrorHandler } from "./streams.js";

function makeSimulatedQuote(
  outputAmount: bigint,
): Extract<SimulatedQuote, { provider: "fabric"; success: true }> {
  return {
    success: true,
    provider: "fabric",
    details: {} as FabricQuoteResponse,
    latency: 0,
    inputChainId: 8453,
    outputChainId: 8453,
    execution: "atomic",
    inputAmount: 1_000_000n,
    outputAmount,
    networkFee: 1n,
    txData: { to: "0x0000000000000000000000000000000000000001", data: "0x" },
    simulation: {
      success: true,
      outputAmount,
      swapResult: {} as SimulationSuccess["swapResult"],
      latency: 0,
      gasUsed: 1n,
      blockNumber: 1n,
    },
    performance: {
      latency: 0,
      gasUsed: 1n,
      outputAmount,
      priceDelta: 0,
      accuracy: 0,
    },
  };
}

function withDelay<T>(value: T, delayMs: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}

describe("proxy", () => {
  const baseUrl = "https://example.com/api";
  const delegatedActions: ["prepareQuotes", "prepareSimulatedQuotes"] = [
    "prepareQuotes",
    "prepareSimulatedQuotes",
  ];
  let originalFetch: typeof fetch;
  let requests: Array<{ url: string; headers: Headers }>;
  let responses: Response[];

  async function enqueue(swap: SwapParams) {
    const quotes = await recordedQuotes("proxy", swap, testConfig([fabric({ appId: "test-app" })]));
    const stream = newStream<Quote>(
      quotes.map((q) => Promise.resolve(q)),
      quoteStreamErrorHandler,
    );
    responses.push(
      new Response(stream, {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
  }

  function enqueueSimulated() {
    const stream = newStream<SimulatedQuote>(
      [Promise.resolve(makeSimulatedQuote(10n))],
      simulatedQuoteStreamErrorHandler,
    );
    responses.push(
      new Response(stream, {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
  }

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    requests = [];
    responses = [];
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const request = new Request(
        input instanceof Request ? input.url : input instanceof URL ? input.toString() : input,
        init,
      );
      requests.push({ url: request.url, headers: new Headers(request.headers) });
      return responses.shift() ?? new Response(null, { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("delegates quote fetching to a server", async () => {
    await enqueue(defaultSwapParams);

    const quotes = await getRawQuotes({
      config: createConfig({
        proxy: proxy({ pathOrUrl: baseUrl, delegatedActions }),
      }),
      swap: defaultSwapParams,
    });

    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
    expect(quotes?.[0]?.provider).toBe("fabric");
    expect(new URL(requests[0]?.url || "").pathname).toBe("/api/prepareQuotes");
  }, 10_000);

  it("forwards recipientAccount to the proxy query", async () => {
    const recipientAccount: Address = "0x0000000000000000000000000000000000000abc";
    const swap = {
      ...defaultSwapParams,
      recipientAccount,
    };
    await enqueue(swap);

    await getRawQuotes({
      config: createConfig({
        proxy: proxy({ pathOrUrl: baseUrl, delegatedActions }),
      }),
      swap,
    });

    const request = requests[0];
    expect(request).toBeDefined();
    const url = new URL(request?.url || "");
    expect(url.searchParams.get("recipientAccount")).toBe(recipientAccount);
  }, 10_000);

  it("forwards outputChainId to the proxy query", async () => {
    const swap = {
      ...defaultSwapParams,
      outputChainId: 10,
    };
    const stream = newStream<Quote>(
      [
        Promise.resolve({
          success: true,
          provider: "fabric",
          details: {} as FabricQuoteResponse,
          latency: 0,
          inputChainId: 8453,
          outputChainId: 10,
          execution: "atomic",
          inputAmount: 1_000_000n,
          outputAmount: 10n,
          networkFee: 1n,
          txData: { to: "0x0000000000000000000000000000000000000001", data: "0x" },
        } as Extract<Quote, { provider: "fabric" }>),
      ],
      quoteStreamErrorHandler,
    );
    responses.push(
      new Response(stream, {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );

    await getRawQuotes({
      config: createConfig({
        proxy: proxy({ pathOrUrl: baseUrl, delegatedActions }),
      }),
      swap,
    });

    const request = requests[0];
    expect(request).toBeDefined();
    const url = new URL(request?.url || "");
    expect(url.searchParams.get("outputChainId")).toBe("10");
  }, 10_000);

  it("adds optional headers to the proxy request", async () => {
    await enqueue(defaultSwapParams);

    await getRawQuotes({
      config: createConfig({
        proxy: proxy({
          pathOrUrl: baseUrl,
          delegatedActions,
          headers: { "X-Custom-Header": "CustomValue" },
        }),
      }),
      swap: defaultSwapParams,
    });

    const request = requests[0];
    expect(request).toBeDefined();
    expect(request?.headers.get("X-Custom-Header")).toBe("CustomValue");
  }, 10_000);

  it("streams simulated quotes from the proxy", async () => {
    enqueueSimulated();

    const quotes = await getQuotes({
      config: createConfig({
        proxy: proxy({ pathOrUrl: baseUrl, delegatedActions }),
      }),
      swap: defaultSwapParams,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.simulation).toBeDefined();
    expect(new URL(requests[0]?.url || "").pathname).toBe("/api/prepareSimulatedQuotes");
  }, 10_000);

  it("selects quotes locally from streamed simulated proxy results", async () => {
    enqueueSimulated();

    const quote = await getQuote({
      config: createConfig({
        proxy: proxy({ pathOrUrl: baseUrl, delegatedActions }),
      }),
      swap: defaultSwapParams,
      strategy: "fastest",
    });

    expect(quote).not.toBeNull();
    expect(quote?.simulation.success).toBe(true);
  }, 10_000);

  it("aborts the remote simulated stream when fastest resolves", async () => {
    let aborted = false;
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const request = new Request(
        input instanceof Request ? input.url : input instanceof URL ? input.toString() : input,
        init,
      );
      requests.push({ url: request.url, headers: new Headers(request.headers) });
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
      });
      return new Response(
        newStream<SimulatedQuote>(
          [withDelay(makeSimulatedQuote(10n), 20), withDelay(makeSimulatedQuote(9n), 250)],
          simulatedQuoteStreamErrorHandler,
        ),
        {
          headers: { "Content-Type": "application/octet-stream" },
        },
      );
    }) as typeof fetch;

    const quote = await getQuote({
      config: createConfig({
        proxy: proxy({ pathOrUrl: baseUrl, delegatedActions }),
      }),
      swap: defaultSwapParams,
      strategy: "fastest",
    });

    expect(quote?.simulation.outputAmount).toBe(10n);
    await Bun.sleep(50);
    expect(aborted).toBe(true);
  }, 10_000);
});

describe("proxy delegatedActions config", () => {
  it("requires at least one delegated action", () => {
    expect(() =>
      proxy({
        pathOrUrl: "https://example.com/api",
        delegatedActions: [] as unknown as ["prepareQuotes"],
      }),
    ).toThrow("at least one delegated action");
  });

  it("supports delegatedActions using function names", () => {
    const delegated = proxy({
      pathOrUrl: "https://example.com/api",
      delegatedActions: ["prepareQuotes"],
    });
    const both = proxy({
      pathOrUrl: "https://example.com/api",
      delegatedActions: ["prepareQuotes", "prepareSimulatedQuotes"],
    });

    expect(delegated.isDelegatedAction("prepareQuotes")).toBe(true);
    expect(delegated.isDelegatedAction("prepareSimulatedQuotes")).toBe(false);
    expect(both.isDelegatedAction("prepareQuotes")).toBe(true);
    expect(both.isDelegatedAction("prepareSimulatedQuotes")).toBe(true);
  });
});
