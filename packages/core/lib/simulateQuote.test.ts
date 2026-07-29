import { describe, expect, it } from "bun:test";
import type { Address } from "viem";
import { toHex } from "viem";
import { fabric, getQuote, getRawQuotes, kyberswap } from "../index.js";
import { defaultSwapParams, testConfig, USDC_WHALE } from "../test/utils.js";
import { simulateQuotes } from "./simulateQuote.js";
import type { SimulatedQuote } from "./types.js";

const FABRIC_VANITY_ACCOUNT: Address = "0x0fabfabfabfabfabfabfabfabfabfabfabfabfab";
const FABRIC_VANITY_USDC_BALANCE_SLOT =
  "0xaaabaa18f16f048d904f82d05042c130143069b2ff150f1c4b085d0d21e2c9b2";

describe("simulateQuote", () => {
  const config = testConfig([
    kyberswap({ clientId: "spandex-test-env" }),
    fabric({ appId: "spandex-test-env" }),
  ]);
  const client = config.clientLookup(defaultSwapParams.chainId);
  if (!client) {
    throw new Error("Base PublicClient is not configured");
  }

  it("simulates quotes", async () => {
    const swapParams = {
      ...defaultSwapParams,
      swapperAccount: USDC_WHALE,
    };

    const quotes = await getRawQuotes({ config, swap: swapParams });
    expect(quotes).toBeDefined();
    expect(quotes.length).toBeGreaterThan(0);

    const simulated = await simulateQuotes({
      quotes,
      client,
      swap: swapParams,
    });

    console.table(simulated.map(summarize));

    for (const quote of simulated) {
      if (quote.simulation.success) {
        expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
        expect(quote.simulation.gasUsed).toBeGreaterThan(0);
        expect(quote.simulation.approvalGasUsed).toBeGreaterThan(0);
        expect(quote.simulation.latency).toBeGreaterThan(0);
      }
    }
  }, 30000);

  it("simulates an indicative Base swap with a USDC balance override", async () => {
    const swapParams = {
      ...defaultSwapParams,
      swapperAccount: FABRIC_VANITY_ACCOUNT,
    };
    if (swapParams.mode !== "exactIn") {
      throw new Error("Expected the default swap to use exact-input mode");
    }

    const quote = await getQuote({
      config: testConfig([fabric({ appId: "spandex-test-env" })]),
      swap: swapParams,
      strategy: "fastest",
      simulationOptions: {
        stateOverrides: [
          {
            address: swapParams.inputToken,
            stateDiff: [
              {
                slot: FABRIC_VANITY_USDC_BALANCE_SLOT,
                value: toHex(swapParams.inputAmount, { size: 32 }),
              },
            ],
          },
        ],
      },
    });

    expect(quote).not.toBeNull();
    if (!quote) {
      throw new Error("Expected a successful simulated quote");
    }
    expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
    expect(quote.simulation.gasUsed ?? 0n).toBeGreaterThan(0n);
    expect(quote.simulation.approvalGasUsed ?? 0n).toBeGreaterThan(0n);
  }, 30_000);
});

function summarize(quote: SimulatedQuote) {
  const pct =
    quote.simulation.success && quote.success
      ? (Number(quote.simulation.outputAmount - quote.outputAmount) / Number(quote.outputAmount)) *
        10_000
      : 0;

  let delta = "-";
  if (pct > 0) {
    delta = `+${pct.toFixed(2)} bps`;
  } else if (pct < 0) {
    delta = `${pct.toFixed(2)} bps`;
  }

  return {
    provider: quote.provider,
    success: quote.success ? "y" : "n",
    latency: quote.success ? quote.latency : "-",
    quotedAmount: quote.success ? quote.outputAmount : "-",
    simulationSuccess: quote.simulation.success ? "y" : "n",
    simulatedAmount: quote.simulation.success ? quote.simulation.outputAmount : "-",
    gasUsed: quote.simulation.success ? quote.simulation.gasUsed : "-",
    quoteError: quote.success ? "-" : quote.error?.message || "-",
    simulationError: quote.simulation.success ? "-" : quote.simulation.error.message || "-",
    simulationLatency: quote.simulation.success ? quote.simulation.latency : "-",
    delta,
  };
}
