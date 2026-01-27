import type { ExactInSwapParams } from "@spandex/core";
import { createConfig, fabric, getQuote } from "@spandex/core";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

const walletClient = createWalletClient({
  account: "0xdead00000000000000000000000000000000beef",
  chain: base,
  transport: http(),
});

export const config = createConfig({
  providers: [fabric({ appId: "your app id" })],
});

const swap: ExactInSwapParams = {
  mode: "exactIn",
  chainId: 8453,
  inputToken: "0x4200000000000000000000000000000000000006",
  outputToken: "0xd9AAEC86B65D86f6A7B5B1b0c42FFA531710b6CA",
  inputAmount: 1_000000000000000000n, // 1 WETH
  slippageBps: 50,
  swapperAccount: "0x1234567890abcdef1234567890abcdef12345678",
};

// use the quoted price strategy; see Strategies for other options
const bestQuote = await getQuote({
  config,
  swap,
  strategy: "bestPrice",
});

if (!bestQuote) {
  throw new Error("No providers responded in time");
}

const tx = await walletClient.sendTransaction(bestQuote.txData);

console.log(`Tx: ${tx}`);
