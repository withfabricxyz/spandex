import { buildMetaAggregator, type ExactInSwapParams } from "@withfabric/smal";
import { SimulatedMetaAggregator } from "@withfabric/smal-simulate";
import { createPublicClient, http, type PublicClient } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(),
}) as PublicClient;

const params: ExactInSwapParams = {
  chainId: 8453,
  mode: "exactInQuote",
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
};

const metaAggregator = buildMetaAggregator({
  aggregators: [
    { provider: "fabric", config: {} },
    { provider: "0x", config: { apiKey: "" } },
    { provider: "kyberswap", config: { clientId: "" } },
    { provider: "odos", config: {} },
  ],
  defaults: {
    strategy: "quotedPrice",
    deadlineMs: 3_000,
    numRetries: 2,
  },
});

// Cast to any to bypass duplicate viem type instance mismatch.
// biome-ignore lint/suspicious/noExplicitAny: temporary, why?
const quoter = new SimulatedMetaAggregator(metaAggregator, client as any);

const quotes = await quoter.fetchQuotes(params);

for (const quote of quotes) {
  console.log(
    `${quote.provider}: `,
    quote.simulation.success ? quote.simulation.outputAmount : quote.simulation.error,
  );
}
