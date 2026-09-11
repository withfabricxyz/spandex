import { describe, expect, it } from "bun:test";
import { getRawQuotes, kyberswap } from "../index.js";
import { defaultSwapParams, testConfig, USDC_WHALE } from "../test/utils.js";
import { simulateQuotes } from "./simulateQuote.js";
import type { SimulatedQuote } from "./types.js";

describe("simulateQuote", () => {
  const config = testConfig([kyberswap({ clientId: "spandex-test-env" })]);
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
