import { describe, expect, it } from "bun:test";
import {
  defaultSwapParams,
  recordedSimulation,
  testConfig,
  USDC_WHALE,
} from "packages/core/test/utils.js";
import type { Address } from "viem";
import type { SwapParams } from "../types.js";
import { netOutputs } from "./netOutputs.js";

describe("netOutputs", () => {
  it("extracts proper output amounts for ERC20 tokens", async () => {
    const swap = {
      ...defaultSwapParams,
      inputAmount: 50_000_000_000n,
      swapperAccount: USDC_WHALE,
    } as SwapParams;

    const quote = await recordedSimulation(
      "netOutputs-erc20-out",
      swap,
      testConfig({
        fabric: { clientId: "spandex" },
      }),
    );

    const net = netOutputs({
      logs: quote.simulation.callsResults[1]?.logs ?? [],
      swap,
    });

    expect(net.outputToken.get(swap.swapperAccount.toLowerCase() as Address)).toBeGreaterThan(
      (quote.outputAmount * 98n) / 100n,
    );
    expect(
      net.outputToken.get("0x484ce84a92a17c108c94a91bb222daef93eb8ce7" as Address),
    ).toBeGreaterThan(0n);
  });

  it("extracts proper output amounts for Kyber", async () => {
    const swap = {
      ...defaultSwapParams,
      inputAmount: 5_00_000_000n,
      swapperAccount: USDC_WHALE,
    } as SwapParams;

    const quote = await recordedSimulation(
      "netout-kyberswap-erc20-out",
      swap,
      testConfig({
        kyberswap: { clientId: "test-setup" },
      }),
    );

    const net = netOutputs({
      logs: quote.simulation.callsResults[1]?.logs ?? [],
      swap,
    });

    expect(net.outputToken.get(swap.swapperAccount.toLowerCase() as Address)).toBeGreaterThan(
      (quote.outputAmount * 98n) / 100n,
    );
    expect(net.outputToken.get(swap.swapperAccount.toLowerCase() as Address)).toBeGreaterThan(
      (quote.outputAmount * 98n) / 100n,
    );
  });

  it("extracts outputs for 0x", async () => {
    const swap = {
      ...defaultSwapParams,
      inputAmount: 500_000_000n,
      swapperAccount: USDC_WHALE,
    } as SwapParams;

    const quote = await recordedSimulation(
      "netout-0x-erc20-out",
      swap,
      testConfig({
        "0x": {
          apiKey: process.env.ZEROX_API_KEY || "demo",
        },
      }),
    );

    const net = netOutputs({
      logs: quote.simulation.callsResults[1]?.logs ?? [],
      swap,
    });

    expect(net.outputToken.get(swap.swapperAccount.toLowerCase() as Address)).toBeGreaterThan(
      (quote.outputAmount * 98n) / 100n,
    );
    expect(net.inputToken.get("0xad01c20d5886137e056775af56915de824c8fce5" as Address)).toEqual(
      500000n,
    );
  });
});
