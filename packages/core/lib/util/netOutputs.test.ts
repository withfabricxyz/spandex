import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  recordedFabricSimulation,
  USDC_WHALE,
} from "packages/core/test/utils.js";
import type { Address } from "viem";
import type { SwapParams } from "../types.js";
import { netOutputs } from "./netOutputs.js";

describe("netOutputs", () => {
  it("extracts proper output amounts for ERC20 tokens", async () => {
    const swap = {
      ...defaultSwapParams,
      swapperAccount: USDC_WHALE,
    } as SwapParams;

    const quote = await recordedFabricSimulation("netOutputs-erc20-out", swap);
    const net = netOutputs({ quote, swap });

    expect(net.swapper.get(swap.outputToken.toLowerCase() as Address)).toBe(quote.outputAmount);
    expect(
      net.protocols
        .get("0x484ce84a92a17c108c94a91bb222daef93eb8ce7" as Address)
        ?.get(swap.outputToken.toLowerCase() as Address),
    ).toBeDefined();
  });
});
