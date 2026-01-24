import { describe, expect, it } from "bun:test";
import type { PublicClient } from "viem";
import { createPublicClient, http, zeroAddress } from "viem";
import { base } from "viem/chains";
import {
  fabric,
  getQuotes,
  kyberswap,
  odos,
  type SuccessfulQuote,
  type SwapParams,
  zeroX,
} from "../index.js";
import { createConfig } from "./createConfig.js";

const defaultSwapParams: SwapParams = {
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
  mode: "exactIn",
};

const ANKR_API_KEY = process.env.ANKR_API_KEY || "";
const ETH_WHALE = "0x611f7bf868a6212f871e89f7e44684045ddfb09d";
const USDC_WHALE = "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055";

describe("getQuotes", () => {
  const client = createPublicClient({
    chain: base,
    transport: http(`https://rpc.ankr.com/base/${ANKR_API_KEY}`),
  }) as PublicClient;

  const config = createConfig({
    providers: [
      odos({}),
      kyberswap({ clientId: "spandex" }),
      fabric({ appId: "spandex" }),
      zeroX({ apiKey: process.env.ZEROX_API_KEY || "" }),
    ],
    clients: [client] as PublicClient[],
  });

  it("gets simulated quotes", async () => {
    const quotes = await getQuotes({
      config,
      swap: {
        ...defaultSwapParams,
        swapperAccount: USDC_WHALE,
      },
    });

    expect(quotes).toBeDefined();
    expect(Array.isArray(quotes)).toBe(true);

    const [successful, failed] = quotes.reduce(
      (acc, quote) => {
        if (quote.simulation.success) {
          acc[0].push(quote);
        } else {
          acc[1].push(quote);
        }
        return acc;
      },
      [[] as typeof quotes, [] as typeof quotes],
    );

    if (successful.length > 0) {
      console.log("\nSuccessful simulations:");
      console.table(
        successful.map((quote) => ({
          provider: quote.provider,
          outputAmount: quote.simulation.success ? quote.simulation.outputAmount : "N/A",
          gasUsed: quote.simulation.success ? quote.simulation.gasUsed : "N/A",
        })),
      );
    }

    if (failed.length > 0) {
      console.log("\nFailed simulations:");
      for (const quote of failed) {
        console.log(
          `\n${quote.provider} simulation failed: ${quote.simulation.success ? "" : quote.simulation.error}`,
        );
      }
    }

    for (const quote of successful) {
      expect(quote.simulation).toBeDefined();
      expect(typeof quote.simulation.success).toBe("boolean");

      if (quote.simulation.success) {
        expect(quote.simulation.outputAmount).toBeDefined();
        expect(typeof quote.simulation.outputAmount).toBe("bigint");
        expect(quote.simulation.callsResults.length).toBe(3); // approve, swap, balance
        expect(quote.simulation.callsResults.every((res) => res.status === "success")).toBe(true);
        expect(quote.simulation.gasUsed).toBeDefined();

        const tolerance = ((quote as SuccessfulQuote).outputAmount * 5000n) / 10000n; // output within 50%
        expect(quote.simulation.outputAmount).toBeGreaterThanOrEqual(
          (quote as SuccessfulQuote).outputAmount - tolerance,
        );
        expect(quote.simulation.outputAmount).toBeLessThanOrEqual(
          (quote as SuccessfulQuote).outputAmount + tolerance,
        );
      }
    }
  }, 30000);

  it("handles ETH -> ERC20", async () => {
    const quotes = await getQuotes({
      config,
      swap: {
        ...defaultSwapParams,
        inputToken: zeroAddress,
        inputAmount: 250000000000000000n, // .25 ETH
        outputToken: defaultSwapParams.inputToken, // USDC
        swapperAccount: ETH_WHALE,
      },
    });

    const [successful, _failed] = quotes.reduce(
      (acc, quote) => {
        if (quote.simulation.success) {
          acc[0].push(quote);
        } else {
          acc[1].push(quote);
        }
        return acc;
      },
      [[] as typeof quotes, [] as typeof quotes],
    );

    expect(quotes).toBeDefined();

    console.log("\nERC20 -> ETH swap results:");
    console.table(
      successful.map((quote) => ({
        provider: quote.provider,
        quote: (quote as SuccessfulQuote).outputAmount,
        actual: quote.simulation.success ? quote.simulation.outputAmount : "N/A",
        diff: quote.simulation.success
          ? quote.simulation.outputAmount - (quote as SuccessfulQuote).outputAmount
          : "N/A",
      })),
    );

    for (const quote of successful) {
      expect(quote.simulation).toBeDefined();
      expect(typeof quote.simulation.success).toBe("boolean");

      if (quote.simulation.success) {
        expect(quote.simulation.outputAmount).toBeDefined();
        expect(typeof quote.simulation.outputAmount).toBe("bigint");
        expect(quote.simulation.callsResults.length).toBe(2); // swap, balance
        expect(quote.simulation.callsResults.every((res) => res.status === "success")).toBe(true);
        expect(quote.simulation.gasUsed).toBeDefined();

        const tolerance = ((quote as SuccessfulQuote).outputAmount * 500n) / 10000n; // output within 5%
        expect(quote.simulation.outputAmount).toBeGreaterThanOrEqual(
          (quote as SuccessfulQuote).outputAmount - tolerance,
        );
        expect(quote.simulation.outputAmount).toBeLessThanOrEqual(
          (quote as SuccessfulQuote).outputAmount + tolerance,
        );
      }
    }
  }, 30000);

  it("handles ERC20 -> ETH", async () => {
    const quotes = await getQuotes({
      config,
      swap: {
        ...defaultSwapParams,
        outputToken: zeroAddress,
        swapperAccount: USDC_WHALE,
      },
    });
    expect(quotes).toBeDefined();

    const [successful, _failed] = quotes.reduce(
      (acc, quote) => {
        if (quote.simulation.success) {
          acc[0].push(quote);
        } else {
          acc[1].push(quote);
        }
        return acc;
      },
      [[] as typeof quotes, [] as typeof quotes],
    );

    expect(successful.length).toBeGreaterThan(0);

    console.log("\nERC20 -> ETH swap results:");
    console.table(
      successful.map((quote) => ({
        provider: quote.provider,
        quote: (quote as SuccessfulQuote).outputAmount,
        actual: quote.simulation.success ? quote.simulation.outputAmount : "N/A",
        diff: quote.simulation.success
          ? quote.simulation.outputAmount - (quote as SuccessfulQuote).outputAmount
          : "N/A",
      })),
    );

    for (const quote of successful) {
      expect(quote.simulation).toBeDefined();
      expect(typeof quote.simulation.success).toBe("boolean");

      if (quote.simulation.success) {
        expect(quote.simulation.outputAmount).toBeDefined();
        expect(typeof quote.simulation.outputAmount).toBe("bigint");
        expect(quote.simulation.callsResults.length).toBe(2); // swap, balance
        expect(quote.simulation.callsResults.every((res) => res.status === "success")).toBe(true);
        expect(quote.simulation.gasUsed).toBeDefined();

        const tolerance = ((quote as SuccessfulQuote).outputAmount * 500n) / 10000n; // output within 5%
        expect(quote.simulation.outputAmount).toBeGreaterThanOrEqual(
          (quote as SuccessfulQuote).outputAmount - tolerance,
        );
        expect(quote.simulation.outputAmount).toBeLessThanOrEqual(
          (quote as SuccessfulQuote).outputAmount + tolerance,
        );
      }
    }
  }, 30000);

  it("throws without resolving client", async () => {
    expect(async () => {
      await getQuotes({
        config,
        swap: {
          ...defaultSwapParams,
          chainId: 1337, // unsupported chain in this test setup
        },
      });
    }).toThrow();
  });
});
