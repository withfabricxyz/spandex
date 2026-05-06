import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  nativeInputSwap,
  nativeOutputSwap,
  recordOutput,
  testConfig,
  usdcBalanceSwap,
} from "../../test/utils.js";
import { getQuotes } from "../getQuotes.js";
import { RelayAggregator, relay } from "./relay.js";

describe("Relay", () => {
  it("generates a quote", async () => {
    const quoter = new RelayAggregator();
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("relay");

    if (quote.provider !== "relay") {
      throw new Error("Unexpected provider");
    }

    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.networkFee).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.txData.data).toBeDefined();
    }
  }, 30_000);

  it("passes the api key header when configured", async () => {
    const originalFetch = globalThis.fetch;
    let requestHeaders: Headers | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          steps: [
            {
              id: "swap",
              items: [
                {
                  data: {
                    to: "0x0000000000000000000000000000000000000001",
                    data: "0x",
                    value: "0",
                  },
                },
              ],
            },
          ],
          details: {
            currencyIn: { amount: defaultSwapParams.inputAmount.toString() },
            currencyOut: { amount: "900000" },
          },
        }),
      );
    }) as typeof fetch;

    try {
      await relay({ apiKey: "relay-test-key" }).fetchQuote(defaultSwapParams);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requestHeaders?.get("x-api-key")).toBe("relay-test-key");
    expect(requestHeaders?.get("Content-Type")).toBe("application/json");
  });

  it("supports native in", async () => {
    const quote = await recordOutput("relay/native-input", async () => {
      return relay().fetchQuote(nativeInputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "relay") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);

  it("supports native out", async () => {
    const quote = await recordOutput("relay/native-output", async () => {
      return relay().fetchQuote(nativeOutputSwap);
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "relay") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.outputAmount).toBeGreaterThan(0n);
  }, 30_000);

  it("supports cross-chain quotes", async () => {
    const quote = await relay().fetchQuote({
      ...defaultSwapParams,
      outputChainId: 10,
    });

    if (!quote.success || quote.provider !== "relay") {
      throw new Error("Failed to fetch quote");
    }

    expect(quote.execution).toBe("async");
    expect(quote.inputChainId).toBe(8453);
    expect(quote.outputChainId).toBe(10);
    expect(quote.check?.endpoint).toStartWith("https://api.relay.link/intents/status?requestId=0x");
    expect(quote.check?.method).toBe("GET");
    expect(quote.check?.type).toBe("endpoint");
  });

  it("partially simulates cross-chain quotes", async () => {
    const quote = (
      await getQuotes({
        config: testConfig([relay()]),
        swap: {
          ...usdcBalanceSwap,
          outputChainId: 10,
        },
      })
    )[0];

    if (!quote?.success || quote?.provider !== "relay") {
      throw new Error("Failed to fetch quote");
    }

    expect(quote.execution).toBe("async");
    expect(quote.simulation).toBeDefined();
    expect(quote.simulation?.success).toBe(true);
  });
});
