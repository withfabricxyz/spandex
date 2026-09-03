import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  nativeInputSwap,
  testConfig,
  USDC_WHALE,
  usdcBalanceSwap,
} from "../../test/utils.js";
import { getQuote } from "../getQuote.js";
import {
  MobulaAggregator,
  type MobulaQuoteEnvelope,
  type MobulaQuoteResponse,
  mobula,
  mobulaRouteGraph,
} from "./mobula.js";

const ROUTER = "0x1111111111111111111111111111111111111111";
const PERMIT2 = "0x3333333333333333333333333333333333333333";
const POOL = "0x2222222222222222222222222222222222222222";
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const NATIVE_AMOUNT = 10n ** 18n;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];
type FetchMock = (input: FetchInput, init?: FetchInit) => ReturnType<typeof fetch>;

function installFetchMock(mock: FetchMock) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(mock, {
    preconnect: originalFetch.preconnect,
  });

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function captureRequest(body: MobulaQuoteEnvelope, status = 200) {
  const captured: { url?: URL; headers?: Headers } = {};
  const restore = installFetchMock(async (input, init) => {
    captured.url = new URL(
      typeof input === "string" || input instanceof URL ? input.toString() : input.url,
    );
    captured.headers = new Headers(init?.headers);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return { captured, restore };
}

describe("mobula", () => {
  it("provides metadata", () => {
    const aggregator = new MobulaAggregator({ apiKey: "test" });
    expect(aggregator.name()).toBe("mobula");
    expect(aggregator.features()).toEqual(["exactIn", "integratorFees"]);
    const metadata = aggregator.metadata();
    expect(metadata.name).toBe("mobula");
    expect(metadata.url).toBe("https://mobula.io");
    expect(metadata.docsUrl).toBe("https://docs.mobula.io/guides/complete-swap-guide");
  });

  it("requests a quote and normalizes the response", async () => {
    const { captured, restore } = captureRequest({ data: mockMobulaResponse() });

    try {
      const quote = await mobula({ apiKey: "test-key" }).fetchQuote(defaultSwapParams);

      expect(captured.url?.origin).toBe("https://api.mobula.io");
      expect(captured.url?.pathname).toBe("/api/2/swap/quoting");
      expect(captured.headers?.get("authorization")).toBe("Bearer test-key");
      const params = Object.fromEntries(captured.url?.searchParams ?? []);
      expect(params).toEqual({
        chainId: "evm:8453",
        tokenIn: defaultSwapParams.inputToken,
        tokenOut: defaultSwapParams.outputToken,
        amountRaw: "500000000",
        walletAddress: defaultSwapParams.swapperAccount,
        slippage: "1",
      });

      expect(quote.provider).toBe("mobula");
      if (!quote.success || quote.provider !== "mobula") {
        throw new Error("Expected successful mobula quote");
      }
      expect(quote.inputAmount).toBe(500_000_000n);
      expect(quote.outputAmount).toBe(123_456_789_000_000_000n);
      expect(quote.networkFee).toBe(210_000n * 20_000_000_000n);
      expect(quote.txData.to).toBe(ROUTER);
      expect(quote.txData.data).toBe("0x1234");
      expect(quote.txData.value).toBeUndefined();
      expect(quote.txData.gas).toBe(210_000n);
      expect(quote.approval).toEqual({
        token: defaultSwapParams.inputToken,
        spender: PERMIT2,
      });
      expect(quote.route?.nodes.length).toBe(2);
      expect(quote.route?.edges[0]?.address).toBe(POOL);
      expect(quote.pricing?.inputToken?.usdPrice).toBeCloseTo(1, 6);
      expect(quote.details.requestId).toBe("req-1");
    } finally {
      restore();
    }
  });

  it("prefers amountOutRaw when present", async () => {
    const { restore } = captureRequest({
      data: { ...mockMobulaResponse(), amountOutRaw: "42" },
    });
    try {
      const quote = await mobula({ apiKey: "test-key" }).fetchQuote(defaultSwapParams);
      if (!quote.success) throw new Error("Expected success");
      expect(quote.outputAmount).toBe(42n);
    } finally {
      restore();
    }
  });

  it("maps native input to the sentinel address and sets value", async () => {
    const { captured, restore } = captureRequest({
      data: mockMobulaResponse({ value: NATIVE_AMOUNT.toString() }),
    });

    try {
      const quote = await mobula({ apiKey: "test-key" }).fetchQuote(nativeInputSwap);
      expect(captured.url?.searchParams.get("tokenIn")).toBe(NATIVE);
      if (!quote.success) throw new Error("Expected success");
      expect(quote.txData.value).toBe(NATIVE_AMOUNT);
      expect(quote.approval).toBeUndefined();
    } finally {
      restore();
    }
  });

  it("forwards recipient, fee, and protocol filters", async () => {
    const { captured, restore } = captureRequest({ data: mockMobulaResponse() });
    const recipient = "0x0000000000000000000000000000000000000001";
    const feeWallet = "0x0000000000000000000000000000000000000002";

    try {
      await mobula({
        apiKey: "test-key",
        onlyProtocols: ["uniswap-v3"],
        onlyRouters: ["kyberswap", "lifi"],
      }).fetchQuote(
        { ...defaultSwapParams, recipientAccount: recipient },
        { integratorSwapFeeBps: 25, integratorFeeAddress: feeWallet },
      );
      const params = captured.url?.searchParams;
      expect(params?.get("recipientAddress")).toBe(recipient);
      expect(params?.get("feePercentages")).toBe("0.25");
      expect(params?.get("feeWallets")).toBe(feeWallet);
      expect(params?.get("onlyProtocols")).toBe("uniswap-v3");
      expect(params?.get("onlyRouters")).toBe("kyberswap,lifi");
    } finally {
      restore();
    }
  });

  it("honors a custom base URL", async () => {
    const { captured, restore } = captureRequest({ data: mockMobulaResponse() });
    try {
      await mobula({ apiKey: "test-key", baseUrl: "https://mobula.test/v2/" }).fetchQuote(
        defaultSwapParams,
      );
      expect(captured.url?.toString().startsWith("https://mobula.test/v2/swap/quoting?")).toBe(
        true,
      );
    } finally {
      restore();
    }
  });

  it("fails when the API returns a routing error envelope", async () => {
    const { restore } = captureRequest({ data: null, error: "No route found" });
    try {
      const quote = await mobula({ apiKey: "test-key" }).fetchQuote(defaultSwapParams, {
        numRetries: 0,
      });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toBe("No route found");
    } finally {
      restore();
    }
  });

  it("fails on non-2xx responses", async () => {
    const { restore } = captureRequest({ data: null, error: "Unauthorized" }, 401);
    try {
      const quote = await mobula({ apiKey: "bad" }).fetchQuote(defaultSwapParams, {
        numRetries: 0,
      });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toMatch(/401/);
    } finally {
      restore();
    }
  });

  it("fails when the quote has no EVM transaction", async () => {
    const { restore } = captureRequest({ data: { ...mockMobulaResponse(), evm: null } });
    try {
      const quote = await mobula({ apiKey: "test-key" }).fetchQuote(defaultSwapParams, {
        numRetries: 0,
      });
      expect(quote.success).toBe(false);
    } finally {
      restore();
    }
  });

  it("does not support exact output quotes", async () => {
    const quote = await mobula({ apiKey: "test-key" }).fetchQuote(
      {
        chainId: 8453,
        inputToken: defaultSwapParams.inputToken,
        outputToken: defaultSwapParams.outputToken,
        outputAmount: 10n ** 17n,
        slippageBps: 100,
        swapperAccount: defaultSwapParams.swapperAccount,
        mode: "targetOut",
      },
      { numRetries: 0 },
    );
    expect(quote.success).toBe(false);
    expect(quote.provider).toBe("mobula");
  });

  it("does not support cross-chain quotes", async () => {
    const quote = await mobula({ apiKey: "test-key" }).fetchQuote(
      { ...defaultSwapParams, outputChainId: 1 },
      { numRetries: 0 },
    );
    expect(quote.success).toBe(false);
  });

  it("builds a route DAG, chaining hops without token addresses", () => {
    const dag = mobulaRouteGraph(mockMobulaResponse());
    expect(dag.nodes.length).toBe(2);
    expect(dag.edges.length).toBe(1);
    expect(dag.edges[0]?.source).toBe(defaultSwapParams.inputToken);
    expect(dag.edges[0]?.target).toBe(defaultSwapParams.outputToken);
    expect(dag.edges[0]?.key).toBe(POOL);

    const intermediate = "0x4444444444444444444444444444444444444444";
    const multi = mobulaRouteGraph({
      ...mockMobulaResponse(),
      details: {
        route: {
          hops: [
            { exchange: "Uniswap V3", tokenOut: intermediate, amountInRaw: "1" },
            { exchange: "Aerodrome", amountInRaw: "2" },
          ],
        },
      },
    });
    expect(multi.nodes.length).toBe(3);
    expect(multi.edges.map((e) => [e.source, e.target])).toEqual([
      [defaultSwapParams.inputToken, intermediate],
      [intermediate, defaultSwapParams.outputToken],
    ]);
    expect(multi.edges[1]?.key).toBe("Aerodrome-1");
  });
});

function mockMobulaResponse(
  tx: Partial<NonNullable<MobulaQuoteResponse["evm"]>["transaction"]> = {},
): MobulaQuoteResponse {
  return {
    amountOutTokens: "0.123456789",
    amountInUSD: 500,
    amountOutUSD: 499.5,
    slippagePercentage: 1,
    marketImpactPercentage: 0.01,
    tokenIn: { address: defaultSwapParams.inputToken, symbol: "USDC", decimals: 6 },
    tokenOut: { address: defaultSwapParams.outputToken, symbol: "WETH", decimals: 18 },
    requestId: "req-1",
    details: {
      route: {
        hops: [
          {
            poolAddress: POOL,
            exchange: "Uniswap V3",
            poolType: "v3",
            feeBps: 5,
            amountInRaw: "500000000",
            amountOutRaw: "123456789000000000",
          },
        ],
        aggregator: "naos",
      },
    },
    evm: {
      transaction: {
        to: ROUTER,
        from: defaultSwapParams.swapperAccount,
        data: "0x1234",
        value: "0",
        gasLimit: "210000",
        maxFeePerGas: "20000000000",
        maxPriorityFeePerGas: "1000000000",
        chainId: 8453,
        approvalAddress: PERMIT2,
        approvals: [{ token: defaultSwapParams.inputToken, spender: PERMIT2 }],
        ...tx,
      },
    },
  };
}

const MOBULA_API_KEY = process.env.MOBULA_API_KEY;
const ANKR_API_KEY = process.env.ANKR_API_KEY;

describe.skipIf(!MOBULA_API_KEY || !ANKR_API_KEY)("mobula integration", () => {
  const provider = () => mobula({ apiKey: MOBULA_API_KEY ?? "" });

  it("fetches a live quote", async () => {
    const quote = await provider().fetchQuote(usdcBalanceSwap);
    expect(quote.provider).toBe("mobula");
    if (!quote.success) {
      throw quote.error ?? new Error("Expected successful mobula quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
    expect(quote.txData.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(quote.txData.data).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(quote.approval?.spender).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(quote.route?.nodes.length).toBeGreaterThan(0);
  }, 30_000);

  it("fetches a live native input quote", async () => {
    const quote = await provider().fetchQuote({ ...nativeInputSwap, swapperAccount: USDC_WHALE });
    if (!quote.success) {
      throw quote.error ?? new Error("Expected successful mobula quote");
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
      throw new Error(`mobula simulation failed: ${JSON.stringify(quote?.simulation)}`);
    }
    expect(quote.provider).toBe("mobula");
    expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
    expect(quote.simulation.gasUsed).toBeGreaterThan(0);
  }, 60_000);
});
