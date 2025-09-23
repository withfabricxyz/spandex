import type { SwapParams } from "../lib/types";
import { http, createPublicClient } from "viem";
import { base } from "viem/chains";

export const baseClient = createPublicClient({
  chain: base,
  transport: http(`https://rpc.ankr.com/base/${process.env.ANKR_API_KEY}`),
});

export const defaultSwapParams: SwapParams = {
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
};