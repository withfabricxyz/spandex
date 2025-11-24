import { buildMetaAggregator, type ExactInSwapParams, type Quote } from "@withfabric/smal";

// return a random successful quote
const randomStrategy = async (quotes: Array<Promise<Quote>>) => {
  const resolved = await Promise.all(quotes);
  const successful = resolved.filter((q) => q.success);

  if (successful.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * successful.length);
  return successful[randomIndex];
};

const customQuoter = buildMetaAggregator({
  aggregators: [
    { provider: "fabric", config: {} },
    // ... other providers
  ],
  defaults: {
    strategy: randomStrategy,
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

const randomQuote = await customQuoter.fetchBestQuote(params);

if (!randomQuote) {
  throw new Error("No providers succeeded");
}

console.log(`Random selection: ${randomQuote.provider} with ${randomQuote.outputAmount}`);
