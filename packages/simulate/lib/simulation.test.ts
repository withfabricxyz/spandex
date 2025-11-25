import { describe, expect, it } from "bun:test";
import { buildMetaAggregator, type SwapParams } from "@withfabric/smal";
import type { Address, PublicClient } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { simulateQuotes } from "./simulation.js";
import type { SimulatedQuote } from "./types.js";

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
const USDC_WHALE: Address = "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055";

describe("SimulatedMetaAggregator", () => {
  const client = createPublicClient({
    chain: base,
    transport: http(`https://rpc.ankr.com/base/${ANKR_API_KEY}`),
  }) as PublicClient;

  const metaAgg = buildMetaAggregator({
    providers: {
      kyberswap: { clientId: "smal-test-env" },
      fabric: {},
    },
  });

  it("simulates quotes", async () => {
    const swapParams = {
      ...defaultSwapParams,
      swapperAccount: USDC_WHALE,
    };

    const quotes = await metaAgg.fetchQuotes(swapParams);
    expect(quotes).toBeDefined();
    expect(quotes.length).toBeGreaterThan(0);

    const simulated = await simulateQuotes({
      quotes,
      client,
      params: swapParams,
    });

    console.table(simulated.map(summarize));
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
