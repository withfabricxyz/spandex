import type { ExactInSwapParams } from "@withfabric/smal";
import { buildMetaAggregator } from "@withfabric/smal";

const metaAggregator = buildMetaAggregator({
  aggregators: [
    { provider: "fabric", config: {} },
    { provider: "0x", config: { apiKey: "" } },
    { provider: "odos", config: { referralCode: 1234 } },
  ],
});

const params: ExactInSwapParams = {
  mode: "exactInQuote",
  chainId: 8453,
  inputToken: "0x4200000000000000000000000000000000000006",
  outputToken: "0xd9AAEC86B65D86f6A7B5B1b0c42FFA531710b6CA",
  inputAmount: 1_000000000000000000n, // 1 WETH
  slippageBps: 50,
  swapperAccount: "0x1234567890abcdef1234567890abcdef12345678",
};

const quotes = await metaAggregator.fetchQuotes(params);

if (quotes.length === 0) {
  throw new Error("No providers responded in time");
}

for (const quote of quotes) {
  console.log(
    `${quote.provider}: returned ${quote.outputAmount.toString()} after ${quote.latency.toFixed(0)}ms`,
  );
}
