import { describe, expect, it } from "bun:test";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { simulateSwap } from "./simulation";
import type { SwapParams } from "./types";

describe("Simulation", () => {
  const client = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const mockParams: SwapParams = {
    chainId: 8453,
    inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    outputToken: "0x4200000000000000000000000000000000000006",
    inputAmount: 1000000n,
    slippageBps: 100,
    swapperAccount: "0xdead00000000000000000000000000000000beef",
  };

  const mockTxData = {
    to: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    data: "0x" as `0x${string}`,
  };

  it("simulates a swap", async () => {
    const result = await simulateSwap(client, {
      from: mockParams.swapperAccount,
      to: mockTxData.to,
      data: mockTxData.data,
      tokenIn: mockParams.inputToken,
      tokenOut: mockParams.outputToken,
      amountIn: mockParams.inputAmount,
    });

    expect(result).toBeDefined();
    expect(typeof result.success).toBe("boolean");

    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  }, 15_000);
});
