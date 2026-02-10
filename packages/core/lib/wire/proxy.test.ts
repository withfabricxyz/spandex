import { describe, expect, it } from "bun:test";
import { afterEach, beforeEach } from "node:test";
import { mockServer } from "packages/core/test/server.js";
import { defaultSwapParams, recordedQuotes, testConfig } from "packages/core/test/utils.js";
import type { Address } from "viem";
import { fabric } from "../aggregators/fabric.js";
import { createConfig } from "../createConfig.js";
import { getRawQuotes } from "../getRawQuotes.js";
import type { SwapParams } from "../types.js";
import { proxy } from "./proxy.js";
import { newQuoteStream } from "./streams.js";

describe("proxy", async () => {
  let setup: {
    server: Bun.Server<undefined>;
    enqueue: (item: Response) => void;
    requests: Request[];
  };

  async function enqueue(swap: SwapParams) {
    const quotes = await recordedQuotes("proxy", swap, testConfig([fabric({ appId: "test-app" })]));
    const stream = newQuoteStream(quotes.map((q) => Promise.resolve(q)));
    setup.enqueue(
      new Response(stream, {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
  }

  beforeEach(() => {
    setup = mockServer();
  });

  afterEach(() => {
    if (setup?.server) {
      setup.server.stop();
    }
  });

  it("delegates quote fetching to a server", async () => {
    await enqueue(defaultSwapParams);

    // Fetch quotes via proxy
    const quotes = await getRawQuotes({
      config: createConfig({
        proxy: proxy({ pathOrUrl: `http://localhost:${setup.server.port}/quotes` }),
      }),
      swap: defaultSwapParams,
    });

    expect(quotes).toBeDefined();
    expect(quotes.length).toBe(1);
    expect(quotes?.[0]?.provider).toBe("fabric");
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
        proxy: proxy({ pathOrUrl: `http://localhost:${setup.server.port}/quotes` }),
      }),
      swap,
    });

    const request = setup.requests[0];
    expect(request).toBeDefined();
    const url = new URL(request?.url || "");
    expect(url.searchParams.get("recipientAccount")).toBe(recipientAccount);
  }, 10_000);
});
