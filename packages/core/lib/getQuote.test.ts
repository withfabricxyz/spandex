import { describe, expect, it } from "bun:test";
import type { PublicClient } from "viem";
import { defaultSwapParams, MockAggregator, quoteSuccess } from "../test/utils.js";
import type { Config } from "./createConfig.js";
import { getQuote } from "./getQuote.js";
import type { SimulationArgs, SimulationSuccess, SuccessfulSimulatedQuote } from "./types.js";

const baseSimulation: Omit<SimulationSuccess, "outputAmount"> = {
  success: true,
  callsResults: [] as SimulationSuccess["callsResults"],
  latency: 0,
  gasUsed: 0n,
  blockNumber: 0n,
  transfers: [],
};

async function simulateSuccess({ quote }: SimulationArgs): Promise<SuccessfulSimulatedQuote> {
  return {
    ...(quote as SuccessfulSimulatedQuote),
    simulation: {
      ...baseSimulation,
      outputAmount: quote.success ? quote.outputAmount : 0n,
      gasUsed: quote.success ? quote.networkFee : 0n,
    },
  };
}

describe("getQuote", () => {
  it("uses quoted price strategy", async () => {
    const config: Config = {
      aggregators: [
        new MockAggregator(quoteSuccess),
        new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
      ],
      options: {},
      clientLookup: () => undefined,
    };

    const best = await getQuote({
      config,
      swap: defaultSwapParams,
      strategy: "bestPrice",
      simulate: simulateSuccess,
      client: {} as PublicClient,
    });
    expect(best).toBeDefined();
    expect(best?.simulation.outputAmount).toBe(900_001n);
  });

  it("switches strategies per request", async () => {
    const config: Config = {
      aggregators: [
        new MockAggregator({ ...quoteSuccess, networkFee: 1_000n }),
        new MockAggregator({ ...quoteSuccess, outputAmount: 900_001n }),
      ],
      options: {},
      clientLookup: () => undefined,
    };

    let best = await getQuote({
      config,
      swap: defaultSwapParams,
      strategy: "estimatedGas",
      simulate: simulateSuccess,
      client: {} as PublicClient,
    });
    expect(best).toBeDefined();
    expect(best?.simulation.outputAmount).toBe(900_000n);
    best = await getQuote({
      config,
      swap: defaultSwapParams,
      strategy: "bestPrice",
      simulate: simulateSuccess,
      client: {} as PublicClient,
    });
    expect(best).toBeDefined();
    expect(best?.simulation.outputAmount).toBe(900_001n);
  });
});
