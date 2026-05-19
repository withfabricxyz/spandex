import { describe, expect, it } from "bun:test";
import { defaultSwapParams } from "../../test/utils.js";
import { O1Aggregator, type O1QuoteResponse, o1, o1RouteGraph } from "./o1.js";

const ROUTER = "0x1111111111111111111111111111111111111111";
const POOL = "0x2222222222222222222222222222222222222222";

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

describe("o1", () => {
  it("provides metadata", () => {
    const aggregator = new O1Aggregator({
      baseUrl: "https://api.o1.test",
      apiKey: "test",
    });
    expect(aggregator.name()).toBe("o1");
    expect(aggregator.features()).toEqual(["exactIn"]);
    const metadata = aggregator.metadata();
    expect(metadata.name).toBe("o1");
    expect(metadata.url).toMatch(/o1/);
    expect(metadata.docsUrl).toBe("https://docs.o1.exchange/api/dex-aggregator");
  });

  it("posts an execute request and normalizes the response", async () => {
    let requestedUrl: string | undefined;
    let requestedBody: unknown;
    let requestedHeaders: Headers | undefined;

    const restoreFetch = installFetchMock(async (input, init) => {
      requestedUrl =
        typeof input === "string" || input instanceof URL ? input.toString() : input.url;
      requestedBody = JSON.parse(init?.body as string);
      requestedHeaders = new Headers(init?.headers);

      return new Response(JSON.stringify(mockO1Response()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    try {
      const quote = await o1({
        baseUrl: "https://api.o1.test/",
        apiKey: "test-key",
      }).fetchQuote(defaultSwapParams);

      expect(requestedUrl).toBe("https://api.o1.test/execute");
      expect(requestedHeaders?.get("x-api-key")).toBe("test-key");
      expect(requestedBody).toEqual({
        chainId: 8453,
        tokenIn: defaultSwapParams.inputToken,
        tokenOut: defaultSwapParams.outputToken,
        amountIn: "500000000",
        slippageBps: 100,
        user: defaultSwapParams.swapperAccount,
        useNativeIn: false,
        unwrapNativeOut: false,
      });

      expect(quote.provider).toBe("o1");
      if (!quote.success || quote.provider !== "o1") {
        throw new Error("Expected successful o1 quote");
      }
      expect(quote.inputAmount).toBe(500_000_000n);
      expect(quote.outputAmount).toBe(123_456_789n);
      expect(quote.networkFee).toBe(1_000n);
      expect(quote.txData.to).toBe(ROUTER);
      expect(quote.txData.data).toBe("0x1234");
      expect(quote.txData.gas).toBe(210_000n);
      expect(quote.approval).toEqual({
        token: defaultSwapParams.inputToken,
        spender: ROUTER,
      });
      expect(quote.route?.nodes.length).toBe(2);
      expect(quote.route?.edges[0]?.address).toBe(POOL);
    } finally {
      restoreFetch();
    }
  });

  it("does not call the API outside the default Base support", async () => {
    let called = false;
    const restoreFetch = installFetchMock(async () => {
      called = true;
      return new Response("{}");
    });

    try {
      const quote = await o1({
        baseUrl: "https://api.o1.test",
        apiKey: "test-key",
      }).fetchQuote({ ...defaultSwapParams, chainId: 42161 }, { numRetries: 0 });

      expect(quote.success).toBe(false);
      expect(quote.provider).toBe("o1");
      expect(called).toBe(false);
    } finally {
      restoreFetch();
    }
  });

  it("does not support exact output quotes", async () => {
    const quote = await o1({
      baseUrl: "https://api.o1.test",
      apiKey: "test-key",
    }).fetchQuote(
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
    expect(quote.provider).toBe("o1");
  });

  it("rejects separate recipient accounts", async () => {
    const quote = await o1({
      baseUrl: "https://api.o1.test",
      apiKey: "test-key",
    }).fetchQuote(
      {
        ...defaultSwapParams,
        recipientAccount: "0x0000000000000000000000000000000000000001",
      },
      { numRetries: 0 },
    );

    expect(quote.success).toBe(false);
    expect(quote.provider).toBe("o1");
  });

  it("builds a route DAG", () => {
    const dag = o1RouteGraph(mockO1Response());
    expect(dag.nodes.length).toBe(2);
    expect(dag.edges.length).toBe(1);
    expect(dag.edges[0]?.source).toBe(defaultSwapParams.inputToken);
    expect(dag.edges[0]?.target).toBe(defaultSwapParams.outputToken);
    expect(dag.edges[0]?.key).toBe("pool-1");
  });
});

function mockO1Response(): O1QuoteResponse {
  return {
    quoteId: "quote-1",
    chainId: 8453,
    to: ROUTER,
    data: "0x1234",
    value: "0",
    expiresAt: Date.now() + 30_000,
    routePlan: {
      chainId: 8453,
      tokenIn: defaultSwapParams.inputToken,
      tokenOut: defaultSwapParams.outputToken,
      amountIn: "500000000",
      expectedAmountOut: "123456789",
      minAmountOut: "122000000",
      slippageBps: 100,
      blockNumber: 1,
      gasEstimate: {
        gasUnits: 210000,
        gasCostWei: "1000",
      },
      routes: [
        {
          amountIn: "500000000",
          legs: [
            {
              dex: "UNIV3",
              tokenIn: defaultSwapParams.inputToken,
              tokenOut: defaultSwapParams.outputToken,
              amountIn: "500000000",
              minOut: "122000000",
              poolId: "pool-1",
              data: {
                kind: "v3_direct",
                pool: POOL,
              },
            },
          ],
        },
      ],
    },
  };
}
