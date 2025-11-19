import { buildMetaAggregator, type ExactInSwapParams } from "@withfabric/smal";

const gasOptimizedQuoter = buildMetaAggregator({
  aggregators: [
    { provider: "fabric", config: {} },
    // ... other providers
  ],
  defaults: {
    strategy: "quotedGas",
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

const gasQuote = await gasOptimizedQuoter.fetchBestQuote(params);

if (!gasQuote) {
  throw new Error("No providers succeeded");
}

console.log(`${gasQuote.provider} won with lowest gas: ${gasQuote.networkFee}`);
