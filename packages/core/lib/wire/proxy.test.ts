import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { beforeEach } from "node:test";
import { mockServer } from "packages/core/test/server.js";
import { defaultSwapParams, recordedQuotes, testConfig } from "packages/core/test/utils.js";
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
    reset: () => void;
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

  beforeAll(async () => {
    setup = mockServer();
  }, 5_000);

  afterAll(async () => {
    if (setup) {
      setup.server.stop();
    }
  }, 1_000);

  beforeEach(() => {
    setup.reset();
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
});
