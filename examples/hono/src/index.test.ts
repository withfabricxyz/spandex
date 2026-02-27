import { describe, expect, it } from "bun:test";
import { decodeQuoteStream } from "@spandex/core";
import app from "./index.js";

describe("API tests", async () => {
  const defaultParams = new URLSearchParams({
    chainId: "8453",
    inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    outputToken: "0x4200000000000000000000000000000000000006",
    mode: "exactIn",
    inputAmount: "1000000",
    slippageBps: "100",
    swapperAccount: "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055",
  });

  it("fetches a quote (may be flaky depending on upstream)", async () => {
    const res = await app.request(`/api/v1/get_quote?${defaultParams.toString()}`, {
      method: "GET",
    });
    expect(res.status).toBe(200);
  }, 30_000);

  it("stream raw quotes via stream", async () => {
    const res = await app.request(`/api/v1/prepare_quotes?${defaultParams.toString()}`, {
      method: "GET",
    });

    expect(res.status).toBe(200);

    const reader = res.body;
    if (!reader) {
      throw new Error("Response body is null");
    }

    const promises = await decodeQuoteStream(reader);
    const resolved = await Promise.all(promises);
    expect(resolved.length).toBeGreaterThan(0);
  }, 30_000);
});
