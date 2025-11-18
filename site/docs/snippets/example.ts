import type { ExactInSwapParams } from "@withfabric/smal";
import { buildMetaAggregator } from "@withfabric/smal";

const meta = buildMetaAggregator({
  aggregators: [
    {
      provider: "fabric",
      config: {},
    },
    {
      provider: "0x",
      config: {
        apiKey: "YOUR_ZEROX_API_KEY",
      },
    },
    {
      provider: "odos",
      config: {
        referralCode: 1234,
      },
    },
  ],
  defaults: {
    strategy: "quotedPrice",
    deadlineMs: 3_000,
    numRetries: 2,
  },
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

const bestQuote = await meta.fetchBestQuote(params);

if (!bestQuote) {
  throw new Error("No providers responded in time");
}

console.log(
  `Best quote from ${bestQuote.provider} returned ${bestQuote.outputAmount.toString()} after ${bestQuote.latency.toFixed(
    0,
  )}ms`,
);
