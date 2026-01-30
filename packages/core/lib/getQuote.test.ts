import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import type { PublicClient } from "viem";
import { defaultSwapParams, MockAggregator, quoteSuccess } from "../test/utils.js";
import type { Config } from "./createConfig.js";
import { getQuote } from "./getQuote.js";
import type {
  SimulationArgs,
  SimulationSuccess,
  SuccessfulSimulatedQuote,
  SwapParams,
} from "./types.js";

const mockPrepareSimulatedQuotes = mock(
  ({ config, swap, client }: { config: Config; swap: SwapParams; client?: PublicClient }) => {
    const resolvedClient = client ?? ({} as PublicClient);
    return config.aggregators.map((aggregator) =>
      aggregator
        .fetchQuote(swap, config.options)
        .then((quote) => simulateSuccess({ quote, swap, client: resolvedClient })),
    );
  },
);

const baseSimulation: Omit<SimulationSuccess, "outputAmount"> = {
  success: true,
  swapResult: {} as SimulationSuccess["swapResult"],
  latency: 0,
  gasUsed: 0n,
  blockNumber: 0n,
  assetChanges: [] as SimulationSuccess["assetChanges"],
};

async function simulateSuccess({ quote }: SimulationArgs): Promise<SuccessfulSimulatedQuote> {
  if (!quote.success) {
    throw new Error("Cannot simulate failed quote");
  }
  const simulation: SimulationSuccess = {
    ...baseSimulation,
    outputAmount: quote.outputAmount,
    gasUsed: quote.networkFee,
  };
  return {
    ...quote,
    simulation,
    performance: {
      latency: quote.latency,
      gasUsed: simulation.gasUsed ?? 0n,
      outputAmount: simulation.outputAmount,
      priceDelta: 0,
      accuracy: 0,
    },
  };
}

describe("getQuote", () => {
  beforeAll(() => {
    mock.module("./prepareQuotes.js", () => ({
      prepareSimulatedQuotes: mockPrepareSimulatedQuotes,
    }));
  });

  afterAll(() => {
    mock.restore();
  });

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
      client: {} as PublicClient,
    });
    expect(best).toBeDefined();
    expect(best?.simulation.outputAmount).toBe(900_000n);
    best = await getQuote({
      config,
      swap: defaultSwapParams,
      strategy: "bestPrice",
      client: {} as PublicClient,
    });
    expect(best).toBeDefined();
    expect(best?.simulation.outputAmount).toBe(900_001n);
  });
});
