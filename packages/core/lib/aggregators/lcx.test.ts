import { describe, expect, it } from "bun:test";
import { zeroAddress } from "viem";
import {
  defaultSwapParams,
  nativeInputSwap,
  testConfig,
  USDC_WHALE,
  usdcBalanceSwap,
} from "../../test/utils.js";
import { getQuote } from "../getQuote.js";
import type { ExactInSwapParams } from "../types.js";
import { LcxAggregator, type LcxBuild, type LcxQuote, lcx, lcxRouteGraph } from "./lcx.js";

const ROUTER = "0x0000000000b1ae06c96aB73FF4360d7AeAaB56F0";
const OTHER = "0x1111111111111111111111111111111111111111";
const POOL = "0x2222222222222222222222222222222222222222";
const RECIPIENT = "0x0000000000000000000000000000000000000001";
const NATIVE_AMOUNT = 10n ** 18n;
const swap = defaultSwapParams as ExactInSwapParams;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchMock = (input: FetchInput, init?: FetchInit) => ReturnType<typeof fetch>;
type CapturedRequest = { url: URL; headers: Headers; body: Record<string, unknown> };
type MockReply = { status?: number; body: unknown };

function installFetchMock(mock: FetchMock) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(mock, {
    preconnect: originalFetch.preconnect,
  });

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function json(reply: MockReply) {
  return new Response(JSON.stringify(reply.body), {
    status: reply.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Serves `/quote` and `/build` from the given replies and records every request.
 */
function mockApi(quote: MockReply, build: MockReply = { body: buildEnvelope(mockBuild()) }) {
  const requests: CapturedRequest[] = [];
  const restore = installFetchMock(async (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input.toString() : input.url,
    );
    requests.push({
      url,
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    return json(url.pathname.endsWith("/build") ? build : quote);
  });
  return { requests, restore };
}

function quoteEnvelope(quote: LcxQuote) {
  return { success: true, data: { quote } };
}

function buildEnvelope(build: LcxBuild) {
  return { success: true, data: build };
}

describe("lcx", () => {
  it("provides metadata", () => {
    const aggregator = new LcxAggregator({ apiKey: "test" });
    expect(aggregator.name()).toBe("lcx");
    expect(aggregator.features()).toEqual(["exactIn"]);
    expect(aggregator.nativeTokenAddress()).toBe(zeroAddress);
    const metadata = aggregator.metadata();
    expect(metadata.name).toBe("LCX Liberty DEX");
    expect(metadata.url).toBe("https://dex.lcx.com");
    expect(metadata.docsUrl).toBe("https://dex.lcx.com/docs");
  });

  it("quotes, builds, and normalizes the response", async () => {
    const { requests, restore } = mockApi({ body: quoteEnvelope(mockQuote()) });

    try {
      const quote = await lcx({ apiKey: "test-key" }).fetchQuote(defaultSwapParams);

      expect(requests.length).toBe(2);
      const [quoteRequest, buildRequest] = requests;
      expect(quoteRequest?.url.toString()).toBe("https://swap-api.lcx.com/v1/quote");
      expect(quoteRequest?.headers.get("authorization")).toBe("Bearer test-key");
      expect(quoteRequest?.headers.get("content-type")).toBe("application/json");
      expect(quoteRequest?.body).toEqual({
        chainId: 8453,
        tokenIn: swap.inputToken,
        tokenOut: swap.outputToken,
        amountIn: "500000000",
        slippageBps: 100,
      });
      expect(buildRequest?.url.toString()).toBe("https://swap-api.lcx.com/v1/build");
      expect(buildRequest?.headers.get("authorization")).toBe("Bearer test-key");
      expect(buildRequest?.body).toEqual({
        quoteId: "q_8453_1",
        recipient: swap.swapperAccount,
        slippageBps: 100,
      });

      expect(quote.provider).toBe("lcx");
      if (!quote.success || quote.provider !== "lcx") {
        throw new Error("Expected successful lcx quote");
      }
      expect(quote.inputChainId).toBe(8453);
      expect(quote.outputChainId).toBe(8453);
      expect(quote.inputAmount).toBe(500_000_000n);
      expect(quote.outputAmount).toBe(123_456_789_000_000_000n);
      expect(quote.networkFee).toBe(32_641_663_210_000n);
      expect(quote.txData).toEqual({ to: ROUTER, data: "0x5e98574a" });
      expect(quote.approval).toEqual({ token: swap.inputToken, spender: ROUTER });
      expect(quote.metrics?.priceImpactBps).toBe(12);
      expect(quote.pricing?.inputToken?.usdPrice).toBeCloseTo(1, 6);
      expect(quote.pricing?.outputToken?.decimals).toBe(18);
      expect(quote.route?.edges[0]?.address).toBe(POOL);
      expect(quote.details.quote.quoteId).toBe("q_8453_1");
      expect(quote.details.build.minAmountOut).toBe("122222221110000000");
    } finally {
      restore();
    }
  });

  it("sends the zero address for native input and sets value", async () => {
    const nativeQuote = mockQuote({
      input: { token: zeroAddress, amount: NATIVE_AMOUNT.toString(), decimals: 18 },
      output: {
        token: nativeInputSwap.outputToken,
        amount: "3000000000",
        minimumAmount: "2970000000",
        decimals: 6,
      },
      nativeIn: true,
    });
    const { requests, restore } = mockApi(
      { body: quoteEnvelope(nativeQuote) },
      {
        body: buildEnvelope(
          mockBuild({ value: NATIVE_AMOUNT.toString() }, { minAmountOut: "2970000000" }),
        ),
      },
    );

    try {
      const eeee = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
      for (const inputToken of [zeroAddress, eeee] as const) {
        const quote = await lcx({ apiKey: "test-key" }).fetchQuote({
          ...nativeInputSwap,
          inputToken,
        });
        if (!quote.success) throw quote.error ?? new Error("Expected success");
        expect(quote.txData.value).toBe(NATIVE_AMOUNT);
        expect(quote.approval).toBeUndefined();
      }
      expect(requests.filter((r) => r.url.pathname.endsWith("/quote")).length).toBe(2);
      for (const request of requests.filter((r) => r.url.pathname.endsWith("/quote"))) {
        expect(request.body.tokenIn).toBe(zeroAddress);
      }
    } finally {
      restore();
    }
  });

  it("builds for a separate recipient", async () => {
    const { requests, restore } = mockApi({ body: quoteEnvelope(mockQuote()) });
    try {
      const quote = await lcx({ apiKey: "test-key" }).fetchQuote({
        ...defaultSwapParams,
        recipientAccount: RECIPIENT,
      });
      expect(quote.success).toBe(true);
      expect(requests[1]?.body.recipient).toBe(RECIPIENT);
    } finally {
      restore();
    }
  });

  it("honors a custom base URL", async () => {
    const { requests, restore } = mockApi({ body: quoteEnvelope(mockQuote()) });
    try {
      await lcx({ apiKey: "test-key", baseUrl: "https://lcx.test/v1/" }).fetchQuote(
        defaultSwapParams,
      );
      expect(requests.map((r) => r.url.toString())).toEqual([
        "https://lcx.test/v1/quote",
        "https://lcx.test/v1/build",
      ]);
    } finally {
      restore();
    }
  });

  it("fails without an API key and makes no request", async () => {
    const { requests, restore } = mockApi({ body: quoteEnvelope(mockQuote()) });
    try {
      const quote = await lcx({ apiKey: "" }).fetchQuote(defaultSwapParams, { numRetries: 0 });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toMatch(/LCX_API_KEY/);
      expect(requests.length).toBe(0);
    } finally {
      restore();
    }
  });

  it("fails on error envelopes and does not build", async () => {
    const { requests, restore } = mockApi({
      status: 401,
      body: {
        success: false,
        code: "API_KEY_REQUIRED",
        error: "API_KEY_REQUIRED",
        message: "This API requires a key.",
      },
    });
    try {
      const quote = await lcx({ apiKey: "bad" }).fetchQuote(defaultSwapParams, { numRetries: 0 });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toBe(
        "LCX Liberty DEX /quote request failed with status 401 (API_KEY_REQUIRED)",
      );
      expect(requests.length).toBe(1);
    } finally {
      restore();
    }
  });

  it("fails when the build is refused", async () => {
    const { restore } = mockApi(
      { body: quoteEnvelope(mockQuote()) },
      { status: 400, body: { success: false, code: "price_moved", error: "price_moved" } },
    );
    try {
      const quote = await lcx({ apiKey: "test-key" }).fetchQuote(defaultSwapParams, {
        numRetries: 0,
      });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toMatch(
        /\/build request failed with status 400 \(price_moved\)/,
      );
    } finally {
      restore();
    }
  });

  const mismatches: Array<[string, LcxQuote, LcxBuild, RegExp]> = [
    ["quote spender", mockQuote({ spender: OTHER }), mockBuild(), /spender/],
    [
      "input amount",
      mockQuote({ input: { token: swap.inputToken, amount: "1", decimals: 6 } }),
      mockBuild(),
      /input amount/,
    ],
    [
      "input token",
      mockQuote({ input: { token: OTHER, amount: "500000000", decimals: 6 } }),
      mockBuild(),
      /tokens/,
    ],
    [
      "output token",
      mockQuote({
        output: { token: OTHER, amount: "1", minimumAmount: "1", decimals: 18 },
      }),
      mockBuild(),
      /tokens/,
    ],
    ["build target", mockQuote(), mockBuild({ to: OTHER }), /published router/],
    ["build chain", mockQuote(), mockBuild({ chainId: 1 }), /different chain/],
    ["router deployment", mockQuote(), mockBuild({}, { routerDeployed: false }), /not deployed/],
    ["minimum output", mockQuote(), mockBuild({}, { minAmountOut: "1" }), /minimum output/],
    ["value on a token sell", mockQuote(), mockBuild({ value: "1" }), /value/],
  ];

  for (const [field, quoteBody, buildBody, message] of mismatches) {
    it(`rejects a mismatched ${field}`, async () => {
      const { restore } = mockApi(
        { body: quoteEnvelope(quoteBody) },
        { body: buildEnvelope(buildBody) },
      );
      try {
        const quote = await lcx({ apiKey: "test-key" }).fetchQuote(defaultSwapParams, {
          numRetries: 0,
        });
        expect(quote.success).toBe(false);
        if (quote.success) throw new Error("Expected failure");
        expect(quote.error?.message).toMatch(message);
      } finally {
        restore();
      }
    });
  }

  it("rejects a native sell whose value differs from the input amount", async () => {
    const nativeQuote = mockQuote({
      input: { token: zeroAddress, amount: NATIVE_AMOUNT.toString(), decimals: 18 },
      output: {
        token: nativeInputSwap.outputToken,
        amount: "3000000000",
        minimumAmount: "2970000000",
        decimals: 6,
      },
    });
    const { restore } = mockApi(
      { body: quoteEnvelope(nativeQuote) },
      { body: buildEnvelope(mockBuild({ value: "0" }, { minAmountOut: "2970000000" })) },
    );
    try {
      const quote = await lcx({ apiKey: "test-key" }).fetchQuote(nativeInputSwap, {
        numRetries: 0,
      });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toMatch(/value/);
    } finally {
      restore();
    }
  });

  it("does not request unsupported chains", async () => {
    const { requests, restore } = mockApi({ body: quoteEnvelope(mockQuote()) });
    try {
      const quote = await lcx({ apiKey: "test-key" }).fetchQuote(
        { ...defaultSwapParams, chainId: 534352 },
        { numRetries: 0 },
      );
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toMatch(/chain 534352/);
      expect(requests.length).toBe(0);
    } finally {
      restore();
    }
  });

  it("does not support exact output quotes", async () => {
    const quote = await lcx({ apiKey: "test-key" }).fetchQuote(
      {
        chainId: 8453,
        inputToken: swap.inputToken,
        outputToken: swap.outputToken,
        outputAmount: 10n ** 17n,
        slippageBps: 100,
        swapperAccount: swap.swapperAccount,
        mode: "targetOut",
      },
      { numRetries: 0 },
    );
    expect(quote.success).toBe(false);
    expect(quote.provider).toBe("lcx");
  });

  it("does not support cross-chain quotes", async () => {
    const quote = await lcx({ apiKey: "test-key" }).fetchQuote(
      { ...defaultSwapParams, outputChainId: 1 },
      { numRetries: 0 },
    );
    expect(quote.success).toBe(false);
  });

  it("builds a route DAG from split paths", () => {
    const intermediate = "0x4444444444444444444444444444444444444444";
    const dag = lcxRouteGraph(
      mockQuote({
        routes: [
          {
            amountIn: "300000000",
            hops: [
              {
                dex: "uniswap-v3",
                pool: POOL,
                tokenIn: swap.inputToken,
                tokenOut: swap.outputToken,
              },
            ],
          },
          {
            amountIn: "200000000",
            hops: [
              { dex: "aerodrome", pool: OTHER, tokenIn: swap.inputToken, tokenOut: intermediate },
              {
                dex: "uniswap-v4",
                pool: null,
                poolId: "0xabc",
                tokenIn: intermediate,
                tokenOut: swap.outputToken,
              },
            ],
          },
        ],
      }),
      swap,
    );
    expect(dag.nodes.length).toBe(3);
    expect(dag.edges.map((e) => [e.source, e.target, e.value])).toEqual([
      [swap.inputToken, swap.outputToken, 300_000_000],
      [swap.inputToken, intermediate, 200_000_000],
      [intermediate, swap.outputToken, 200_000_000],
    ]);
    expect(dag.edges[2]?.address).toBeUndefined();
    expect(dag.edges[2]?.key).toBe("0xabc-1-1");
  });
});

function mockQuote(overrides: Partial<LcxQuote> = {}): LcxQuote {
  return {
    quoteId: "q_8453_1",
    chainId: 8453,
    input: { token: swap.inputToken, amount: "500000000", decimals: 6 },
    output: {
      token: swap.outputToken,
      amount: "123456789000000000",
      minimumAmount: "122222221110000000",
      decimals: 18,
    },
    priceImpactPct: 0.121,
    usdValueIn: 500,
    usdValueOut: 499.5,
    gasEstimateWei: "32641663210000",
    gasFeeUSD: 0.06,
    spender: ROUTER,
    nativeIn: false,
    nativeOut: false,
    routes: [
      {
        amountIn: "500000000",
        amountOut: "123456789000000000",
        hops: [
          {
            dex: "uniswap-v3",
            family: "v3",
            pool: POOL,
            tokenIn: swap.inputToken,
            tokenOut: swap.outputToken,
            conditional: false,
          },
        ],
      },
    ],
    venues: ["uniswap-v3"],
    blockNumber: 25_703_757,
    expiresAt: 1_786_136_908,
    stale: false,
    ...overrides,
  };
}

function mockBuild(
  swapOverrides: Partial<LcxBuild["swap"]> = {},
  overrides: Partial<Omit<LcxBuild, "swap">> = {},
): LcxBuild {
  return {
    swap: {
      chainId: 8453,
      to: ROUTER,
      data: "0x5e98574a",
      value: "0",
      ...swapOverrides,
    },
    minAmountOut: "122222221110000000",
    deadline: "1786136908",
    routerDeployed: true,
    simulation: { status: "skipped", why: "awaiting_allowance" },
    ...overrides,
  };
}

const LCX_API_KEY = process.env.LCX_API_KEY;
const DRPC_API_KEY = process.env.DRPC_API_KEY;

describe.skipIf(!LCX_API_KEY || !DRPC_API_KEY)("lcx integration", () => {
  const provider = () => lcx({ apiKey: LCX_API_KEY ?? "" });

  it("fetches a live quote", async () => {
    const quote = await provider().fetchQuote(usdcBalanceSwap);
    expect(quote.provider).toBe("lcx");
    if (!quote.success) {
      throw quote.error ?? new Error("Expected successful lcx quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.txData.to).toBe(ROUTER);
    expect(quote.txData.data).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(quote.approval?.spender).toBe(ROUTER);
  }, 30_000);

  it("fetches a live native input quote", async () => {
    const quote = await provider().fetchQuote({ ...nativeInputSwap, swapperAccount: USDC_WHALE });
    if (!quote.success) {
      throw quote.error ?? new Error("Expected successful lcx quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.txData.value).toBe(NATIVE_AMOUNT);
    expect(quote.approval).toBeUndefined();
  }, 30_000);

  it("simulates a live quote", async () => {
    const quote = await getQuote({
      config: testConfig([provider()]),
      swap: usdcBalanceSwap,
      strategy: "fastest",
    });
    if (!quote?.simulation?.success) {
      throw new Error(`lcx simulation failed: ${JSON.stringify(quote?.simulation)}`);
    }
    expect(quote.provider).toBe("lcx");
    expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
    expect(quote.simulation.gasUsed).toBeGreaterThan(0);
  }, 60_000);
});
