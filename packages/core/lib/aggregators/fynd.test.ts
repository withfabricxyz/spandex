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
  FyndAggregator,
  type FyndOrderQuote,
  type FyndQuoteResponse,
  fynd,
  fyndRouteGraph,
} from "./fynd.js";

const ROUTER = "0x1111111111111111111111111111111111111111";
const POOL = "0x2222222222222222222222222222222222222222";
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

function captureRequest(body: unknown, status = 200) {
  const captured: { url?: string; headers?: Headers; body?: unknown } = {};
  const restore = installFetchMock(async (input, init) => {
    captured.url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
    captured.headers = new Headers(init?.headers);
    captured.body = JSON.parse(init?.body as string);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return { captured, restore };
}

describe("fynd", () => {
  it("provides metadata", () => {
    const aggregator = new FyndAggregator({ apiKey: "test" });
    expect(aggregator.name()).toBe("fynd");
    expect(aggregator.features()).toEqual(["exactIn"]);
    const metadata = aggregator.metadata();
    expect(metadata.name).toBe("fynd");
    expect(metadata.url).toBe("https://fynd.xyz");
    expect(metadata.docsUrl).toBe("https://docs.fynd.xyz/get-started/hosted-api");
  });

  it("posts a hosted quote request and normalizes the response", async () => {
    const { captured, restore } = captureRequest(mockFyndResponse());

    try {
      const quote = await fynd({ apiKey: "test-key" }).fetchQuote(defaultSwapParams, {
        deadlineMs: 4_000,
      });

      expect(captured.url).toBe("https://fynd-api.propellerheads.xyz/v1/base/quote");
      expect(captured.headers?.get("authorization")).toBe("test-key");
      expect(captured.body).toEqual({
        orders: [
          {
            token_in: defaultSwapParams.inputToken,
            token_out: defaultSwapParams.outputToken,
            amount: "500000000",
            side: "sell",
            sender: defaultSwapParams.swapperAccount,
          },
        ],
        options: {
          encoding_options: { slippage: "0.01" },
          timeout_ms: 4000,
        },
      });

      expect(quote.provider).toBe("fynd");
      if (!quote.success || quote.provider !== "fynd") {
        throw new Error("Expected successful fynd quote");
      }
      expect(quote.inputAmount).toBe(500_000_000n);
      expect(quote.outputAmount).toBe(123_456_789n);
      expect(quote.networkFee).toBe(141_239n * 78_012_237n);
      expect(quote.txData.to).toBe(ROUTER);
      expect(quote.txData.data).toBe("0x1234");
      expect(quote.txData.value).toBeUndefined();
      expect(quote.txData.gas).toBeUndefined();
      expect(quote.approval).toEqual({ token: defaultSwapParams.inputToken, spender: ROUTER });
      expect(quote.route?.nodes.length).toBe(2);
      expect(quote.route?.edges[0]?.address).toBe(POOL);
      expect(quote.fees).toEqual([
        { type: "aggregator", token: defaultSwapParams.outputToken, amount: 18_440n },
      ]);
      expect(quote.metrics?.priceImpactBps).toBe(3);
      expect(quote.details.solve_time_ms).toBe(26);
    } finally {
      restore();
    }
  });

  it("targets a self-hosted server without a chain segment or auth header", async () => {
    const { captured, restore } = captureRequest(mockFyndResponse());
    try {
      const quote = await fynd({ baseUrl: "http://localhost:8080/", chainId: 8453 }).fetchQuote(
        defaultSwapParams,
      );
      expect(captured.url).toBe("http://localhost:8080/v1/quote");
      expect(captured.headers?.get("authorization")).toBeNull();
      expect(quote.success).toBe(true);
    } finally {
      restore();
    }
  });

  it("fails fast when a self-hosted server is configured for another chain", async () => {
    let called = false;
    const restore = installFetchMock(async () => {
      called = true;
      return new Response("{}");
    });
    try {
      const quote = await fynd({ baseUrl: "http://localhost:8080", chainId: 1 }).fetchQuote(
        defaultSwapParams,
        { numRetries: 0 },
      );
      expect(quote.success).toBe(false);
      expect(called).toBe(false);
    } finally {
      restore();
    }
  });

  it("fails fast for hosted chains without a known path", async () => {
    let called = false;
    const restore = installFetchMock(async () => {
      called = true;
      return new Response("{}");
    });
    try {
      const quote = await fynd({ apiKey: "k" }).fetchQuote(
        { ...defaultSwapParams, chainId: 999_999 },
        { numRetries: 0 },
      );
      expect(quote.success).toBe(false);
      expect(called).toBe(false);
    } finally {
      restore();
    }
  });

  it("supports chain path overrides and custom hosted base URLs", async () => {
    const { captured, restore } = captureRequest(mockFyndResponse());
    try {
      await fynd({
        apiKey: "k",
        baseUrl: "https://fynd.example/",
        chains: { 999999: "testnet" },
      }).fetchQuote({ ...defaultSwapParams, chainId: 999_999 });
      expect(captured.url).toBe("https://fynd.example/v1/testnet/quote");
    } finally {
      restore();
    }
  });

  it("maps native input to the zero address and sets value", async () => {
    const { captured, restore } = captureRequest(
      mockFyndResponse({
        transaction: { to: ROUTER, data: "0x1234", value: NATIVE_AMOUNT.toString() },
      }),
    );
    try {
      const quote = await fynd({ apiKey: "k" }).fetchQuote(nativeInputSwap);
      const body = captured.body as { orders: { token_in: string }[] };
      expect(body.orders[0]?.token_in).toBe("0x0000000000000000000000000000000000000000");
      if (!quote.success) throw new Error("Expected success");
      expect(quote.txData.value).toBe(NATIVE_AMOUNT);
      expect(quote.approval).toBeUndefined();
    } finally {
      restore();
    }
  });

  it("forwards receiver and solver options", async () => {
    const { captured, restore } = captureRequest(mockFyndResponse());
    const recipient = "0x0000000000000000000000000000000000000001";
    try {
      await fynd({
        apiKey: "k",
        timeoutMsSolver: 1_500,
        minResponses: 2,
        maxGas: 500_000n,
      }).fetchQuote({ ...defaultSwapParams, recipientAccount: recipient }, { deadlineMs: 9_000 });
      const body = captured.body as {
        orders: { receiver?: string }[];
        options: Record<string, unknown>;
      };
      expect(body.orders[0]?.receiver).toBe(recipient);
      expect(body.options.timeout_ms).toBe(1500);
      expect(body.options.min_responses).toBe(2);
      expect(body.options.max_gas).toBe("500000");
    } finally {
      restore();
    }
  });

  it("fails when the solver finds no route", async () => {
    const { restore } = captureRequest(
      mockFyndResponse({ status: "no_route_found", transaction: null }),
    );
    try {
      const quote = await fynd({ apiKey: "k" }).fetchQuote(defaultSwapParams, { numRetries: 0 });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toMatch(/no_route_found/);
    } finally {
      restore();
    }
  });

  it("surfaces API error messages on non-2xx responses", async () => {
    const { restore } = captureRequest({ error: "unknown_chain", code: "NOT_FOUND" }, 404);
    try {
      const quote = await fynd({ apiKey: "k" }).fetchQuote(defaultSwapParams, { numRetries: 0 });
      expect(quote.success).toBe(false);
      if (quote.success) throw new Error("Expected failure");
      expect(quote.error?.message).toMatch(/unknown_chain/);
    } finally {
      restore();
    }
  });

  it("does not support exact output quotes", async () => {
    const quote = await fynd({ apiKey: "k" }).fetchQuote(
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
    expect(quote.provider).toBe("fynd");
  });

  it("builds a route DAG", () => {
    const order = mockFyndResponse().orders[0] as FyndOrderQuote;
    const dag = fyndRouteGraph(order, defaultSwapParams as never);
    expect(dag.nodes.length).toBe(2);
    expect(dag.edges.length).toBe(1);
    expect(dag.edges[0]?.source).toBe(defaultSwapParams.inputToken);
    expect(dag.edges[0]?.target).toBe(defaultSwapParams.outputToken);
    expect(dag.edges[0]?.key).toBe(POOL);
  });
});

function mockFyndResponse(overrides: Partial<FyndOrderQuote> = {}): FyndQuoteResponse {
  return {
    orders: [
      {
        order_id: "order-1",
        status: "success",
        amount_in: "500000000",
        amount_out: "123456789",
        amount_out_net_gas: "123400000",
        gas_estimate: "141239",
        price_impact_bps: 3,
        algorithm: "bellman_ford",
        block: { number: 1, hash: "0xabc", timestamp: 1 },
        gas_price: "78012237",
        route: {
          swaps: [
            {
              component_id: POOL,
              protocol: "uniswap_v3",
              token_in: defaultSwapParams.inputToken,
              token_out: defaultSwapParams.outputToken,
              amount_in: "500000000",
              amount_out: "123456789",
              gas_estimate: "141239",
              split: "0",
            },
          ],
        },
        transaction: { to: ROUTER, data: "0x1234", value: "0" },
        fee_breakdown: {
          router_fee: "18440",
          client_fee: "0",
          max_slippage: "1234567",
          min_amount_received: "122222222",
        },
        ...overrides,
      },
    ],
    total_gas_estimate: "141239",
    solve_time_ms: 26,
  };
}

const FYND_API_KEY = process.env.FYND_API_KEY;
const DRPC_API_KEY = process.env.DRPC_API_KEY;

describe.skipIf(!FYND_API_KEY || !DRPC_API_KEY)("fynd integration", () => {
  const provider = () => fynd({ apiKey: FYND_API_KEY ?? "" });

  it("fetches a live quote", async () => {
    const quote = await provider().fetchQuote(usdcBalanceSwap);
    expect(quote.provider).toBe("fynd");
    if (!quote.success) {
      throw quote.error ?? new Error("Expected successful fynd quote");
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
      throw quote.error ?? new Error("Expected successful fynd quote");
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
      throw new Error(`fynd simulation failed: ${JSON.stringify(quote?.simulation)}`);
    }
    expect(quote.provider).toBe("fynd");
    expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
    expect(quote.simulation.gasUsed).toBeGreaterThan(0);
  }, 60_000);
});
