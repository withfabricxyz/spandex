import { buildMetaAggregator, type ExactInSwapParams } from "@withfabric/smal";

const fastQuoter = buildMetaAggregator({
  providers: {
    fabric: {},
    // ... other providers
  },
});

const params: ExactInSwapParams = {
  chainId: 8453,
  mode: "exactIn",
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
};

// first provider to respond with a quote wins
const fastestQuote = await fastQuoter.fetchBestQuote(params, "fastest");

if (!fastestQuote) {
  throw new Error("No providers responded.");
}

console.log(`${fastestQuote.provider} won: `, fastestQuote.outputAmount);
