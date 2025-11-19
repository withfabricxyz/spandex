import { buildMetaAggregator, type ExactInSwapParams } from "@withfabric/smal";

const priorityQuoter = buildMetaAggregator({
  // priority strategy respects the order of providers as specified here
  aggregators: [
    { provider: "fabric", config: {} },
    { provider: "0x", config: { apiKey: "" } },
    { provider: "kyberswap", config: { clientId: "" } },
    { provider: "odos", config: {} },
  ],
  defaults: {
    strategy: "priority",
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

// prioritize the first successful quote based on the configured order
const priorityQuote = await priorityQuoter.fetchBestQuote(params);

if (!priorityQuote) {
  throw new Error("No providers succeeded");
}

console.log(`${priorityQuote.provider} won: `, priorityQuote.outputAmount);
