import { buildMetaAggregator, type ExactInSwapParams } from "@withfabric/smal";

const priceOptimizedQuoter = buildMetaAggregator({
  aggregators: [
    { provider: "fabric", config: {} },
    // ... other providers
  ],
  defaults: {
    strategy: "quotedPrice",
  },
});

const params: ExactInSwapParams = {
  chainId: 8453,
  mode: "exactInQuote",
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
};

const priceQuote = await priceOptimizedQuoter.fetchBestQuote(params);

if (!priceQuote) {
  throw new Error("No providers succeeded");
}

console.log(`${priceQuote.provider} won with best price: ${priceQuote.outputAmount}`);
