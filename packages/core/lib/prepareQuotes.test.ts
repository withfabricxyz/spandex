import { describe, expect, it } from "bun:test";
import { type Config, createConfig } from "./createConfig.js";
import { prepareQuotes } from "./prepareQuotes.js";
import type { Quote } from "./types.js";

describe("prepareQuotes", () => {
  it("prepares an array of promises", async () => {
    const config: Config = createConfig({
      providers: {
        "0x": { apiKey: "test" },
        fabric: { clientId: "test" },
      },
    });

    const prepared = prepareQuotes({
      config,
      swap: {
        chainId: 8453,
        inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        outputToken: "0x4200000000000000000000000000000000000006",
        inputAmount: 500_000_000n,
        slippageBps: 100,
        swapperAccount: "0xdead00000000000000000000000000000000beef",
        mode: "exactIn",
      },
      mapFn: async (quote: Quote) => quote,
    });

    expect(Array.isArray(prepared)).toBe(true);
    expect(prepared.length).toBe(2); // Two providers configured
  });

  // TODO: Various validations
  it("throws with no providers", async () => {
    const config: Config = {
      aggregators: [],
      options: {},
      clientLookup: () => undefined,
    };

    expect(() => {
      prepareQuotes({
        config,
        swap: {
          chainId: 8453,
          inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          outputToken: "0x4200000000000000000000000000000000000006",
          inputAmount: 500_000_000n,
          slippageBps: 100,
          swapperAccount: "0xdead00000000000000000000000000000000beef",
          mode: "exactIn",
        },
        mapFn: async (quote: Quote) => quote,
      });
    }).toThrow();
  });
});
