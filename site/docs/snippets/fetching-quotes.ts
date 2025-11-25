import { buildMetaAggregator } from "@withfabric/smal";

const aggregator = buildMetaAggregator({
  providers: {
    fabric: {},
    kyberswap: {
      clientId: "smal",
    },
    odos: {
      referralCode: 1234,
    },
  },
  options: {
    deadlineMs: 10_000,
    integratorFeeAddress: "0xFee00000000000000000000000000000000000fee",
    integratorSwapFeeBps: 50,
  },
});

const quotes = await aggregator.fetchQuotes({
  chainId: 8453,
  inputToken: "0x4200000000000000000000000000000000000006",
  outputToken: "0xd9AAEC86B65D86f6A7B5B1b0c42FFA531710b6CA",
  mode: "exactIn",
  inputAmount: 1_000_000_000_000_000_000n, // 1 WETH
  slippageBps: 50,
  swapperAccount: "0x1234567890abcdef1234567890abcdef12345678",
});

if (quotes.length === 0) {
  throw new Error("No providers responded in time");
}

for (const quote of quotes) {
  if (quote.success) {
    console.log(
      `${quote.provider}: returned ${quote.outputAmount.toString()} after ${quote.latency.toFixed(0)}ms`,
    );
  } else {
    console.log(`${quote.provider}: failed with error ${quote.error}`);
  }
}
