import { createConfig, getQuote } from "@withfabric/spandex";

export const config = createConfig({
  providers: {
    fabric: { clientId: "spandex" },
    kyberswap: {
      clientId: "spandex",
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

const quote = await getQuote({
  config,
  swap: {
    chainId: 8453,
    inputToken: "0x4200000000000000000000000000000000000006",
    outputToken: "0xd9AAEC86B65D86f6A7B5B1b0c42FFA531710b6CA",
    mode: "exactIn",
    inputAmount: 1_000_000_000_000_000_000n, // 1 WETH
    slippageBps: 50,
    swapperAccount: "0x1234567890abcdef1234567890abcdef12345678",
  },
  strategy: "bestPrice",
});

if (!quote) {
  throw new Error("No providers provided a quote");
}

console.log(
  `Best quote from ${quote.provider} returned ${quote.outputAmount.toString()} after ${quote.latency.toFixed(
    0,
  )}ms`,
);
