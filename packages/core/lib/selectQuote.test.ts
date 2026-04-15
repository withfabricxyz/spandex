import { describe, expect, it } from "bun:test";
import type { FabricQuoteResponse } from "./aggregators/fabric.js";
import { selectQuote } from "./selectQuote.js";
import type {
  AggregatorFeature,
  SimulatedQuote,
  SimulationSuccess,
  SuccessfulSimulatedQuote,
} from "./types.js";

const baseSimulation: SimulationSuccess = {
  success: true,
  outputAmount: 900_000n,
  latency: 0,
  gasUsed: 5_000n,
  blockNumber: 0n,
};

const quoteSuccess: SuccessfulSimulatedQuote = {
  success: true,
  provider: "fabric",
  details: {} as FabricQuoteResponse,
  latency: 100,
  inputChainId: 8453,
  outputChainId: 8453,
  execution: "atomic",
  inputAmount: 1_000_000n,
  outputAmount: 900_000n,
  networkFee: 5_000n,
  txData: { to: "0x0", data: "0x0" },
  simulation: baseSimulation,
  performance: {
    latency: 100,
    gasUsed: 5_000n,
    outputAmount: 900_000n,
    priceDelta: 0,
    accuracy: 0,
  },
};

const quoteFailure: SimulatedQuote = {
  success: false,
  provider: "fabric",
  error: new Error("Failed to get quote"),
  simulation: {
    success: false,
    error: new Error("Cannot simulate failed quote"),
  },
};

const simulationFailure: SimulatedQuote = {
  ...quoteSuccess,
  simulation: { success: false, error: new Error("Simulation failed") },
};

function makeSuccessfulQuote(
  overrides: Partial<SuccessfulSimulatedQuote>,
): SuccessfulSimulatedQuote {
  const simulationOverride = overrides.simulation as Partial<SimulationSuccess> | undefined;
  const simulationOutput =
    simulationOverride?.outputAmount ??
    (overrides.outputAmount !== undefined
      ? overrides.outputAmount
      : quoteSuccess.simulation.outputAmount);

  return {
    ...quoteSuccess,
    ...overrides,
    simulation: {
      ...quoteSuccess.simulation,
      outputAmount: simulationOutput,
      ...simulationOverride,
    },
    performance: {
      ...quoteSuccess.performance,
      outputAmount: simulationOutput,
      ...(overrides.performance ?? {}),
    },
  } as SuccessfulSimulatedQuote;
}

function withDelay<T>(value: T, delay: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delay));
}

describe("selectQuote", () => {
  it("picks the fastest successful response", async () => {
    const pending = [
      withDelay(makeSuccessfulQuote({ outputAmount: 10n }), 200),
      withDelay(makeSuccessfulQuote({ outputAmount: 7_457n }), 150),
      withDelay(quoteFailure, 10),
    ];

    const output = await selectQuote({ strategy: "fastest", quotes: pending });
    expect(output).toBeDefined();
    expect(output?.simulation.outputAmount).toBe(7_457n);
  }, 1_000);

  it("cancels remaining work after fastest succeeds", async () => {
    let cancelled = false;
    const pending = Object.assign(
      [
        withDelay(makeSuccessfulQuote({ outputAmount: 10n }), 20),
        withDelay(makeSuccessfulQuote({ outputAmount: 9n }), 200),
      ],
      {
        cancel: () => {
          cancelled = true;
        },
      },
    );

    const output = await selectQuote({ strategy: "fastest", quotes: pending });
    expect(output?.simulation.outputAmount).toBe(10n);
    expect(cancelled).toBe(true);
  }, 1_000);

  it("custom selection composes firstN with bestPrice", async () => {
    const pending = [
      withDelay(makeSuccessfulQuote({ outputAmount: 12n }), 60),
      withDelay(simulationFailure, 10),
      withDelay(makeSuccessfulQuote({ outputAmount: 18n }), 30),
      withDelay(makeSuccessfulQuote({ outputAmount: 99n }), 120),
    ];

    const output = await selectQuote({
      strategy: {
        collect: { type: "firstN", count: 2 },
        rank: "bestPrice",
      },
      quotes: pending,
    });

    expect(output).toBeDefined();
    expect(output?.simulation.outputAmount).toBe(18n);
  }, 1_000);

  it("waits for the requested number of successful quotes", async () => {
    const pending = [
      withDelay(quoteFailure, 5),
      withDelay(makeSuccessfulQuote({ outputAmount: 9n }), 50),
      withDelay(simulationFailure, 10),
      withDelay(makeSuccessfulQuote({ outputAmount: 11n }), 40),
    ];

    const output = await selectQuote({
      strategy: {
        collect: { type: "firstN", count: 2 },
        rank: "bestPrice",
      },
      quotes: pending,
    });

    expect(output).toBeDefined();
    expect(output?.simulation.outputAmount).toBe(11n);
  }, 1_000);

  it("custom selection composes benchmark with bestPrice", async () => {
    const pending = [
      withDelay(makeSuccessfulQuote({ provider: "odos", outputAmount: 14n }), 20),
      withDelay(makeSuccessfulQuote({ provider: "fabric", outputAmount: 11n }), 50),
      withDelay(makeSuccessfulQuote({ provider: "relay", outputAmount: 30n }), 200),
    ];

    const output = await selectQuote({
      strategy: {
        collect: {
          type: "benchmark",
          provider: "fabric",
          minQuotes: 2,
        },
        rank: "bestPrice",
      },
      quotes: pending,
    });

    expect(output).toBeDefined();
    expect(output?.provider).toBe("odos");
    expect(output?.simulation.outputAmount).toBe(14n);
  }, 1_000);

  it("supports a custom collect function inside a strategy plan", async () => {
    const pending = [
      withDelay(makeSuccessfulQuote({ provider: "odos", outputAmount: 12n }), 20),
      withDelay(makeSuccessfulQuote({ provider: "fabric", outputAmount: 18n }), 40),
      withDelay(makeSuccessfulQuote({ provider: "relay", outputAmount: 30n }), 200),
    ];

    const output = await selectQuote({
      strategy: {
        collect: async (quotes) => {
          const resolved = await Promise.all(quotes);
          return resolved
            .filter(
              (quote): quote is SuccessfulSimulatedQuote =>
                quote.success && quote.simulation.success && quote.provider !== "relay",
            )
            .slice(0, 2);
        },
        rank: "bestPrice",
      },
      quotes: pending,
    });

    expect(output).toBeDefined();
    expect(output?.provider).toBe("fabric");
    expect(output?.simulation.outputAmount).toBe(18n);
  }, 1_000);

  it("supports a custom rank function inside a strategy plan", async () => {
    const pending = [
      Promise.resolve(
        makeSuccessfulQuote({
          provider: "fabric",
          outputAmount: 1_000n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 1_000n },
        }),
      ),
      Promise.resolve(
        makeSuccessfulQuote({
          provider: "odos",
          outputAmount: 900n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 900n },
        }),
      ),
    ];

    const output = await selectQuote({
      strategy: {
        collect: { type: "all" },
        rank: (quotes) => quotes[Math.floor(Math.random() * quotes.length)] ?? null,
      },
      quotes: pending,
    });

    expect(output).toBeDefined();
    expect(["fabric", "odos"]).toContain(output?.provider);
  });

  it("price selection - best simulated output relative to input is chosen", async () => {
    const pending = [
      Promise.resolve(simulationFailure),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 13n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 13n },
        }),
      ),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 15n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 15n },
        }),
      ),
    ];
    const output = await selectQuote({ strategy: "bestPrice", quotes: pending });
    expect(output).toBeDefined();
    expect(output?.simulation.outputAmount).toBe(15n);
  }, 1_000);

  it("price selection prefers higher priority even if output is worse", async () => {
    const pending = [
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 100n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 100n },
          activatedFeatures: [],
        }),
      ),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 10n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 10n },
          activatedFeatures: ["integratorFees"] as AggregatorFeature[],
        }),
      ),
    ];
    const output = await selectQuote({ strategy: "bestPrice", quotes: pending });
    expect(output).toBeDefined();
    expect(output?.simulation.outputAmount).toBe(10n);
  }, 1_000);

  it("gas optimized - selects the cheapest in terms of gas", async () => {
    const pending = [
      Promise.resolve(simulationFailure),
      Promise.resolve(
        makeSuccessfulQuote({
          networkFee: 1_500_000_000n,
          simulation: { ...quoteSuccess.simulation, gasUsed: 1_500_000_000n },
        }),
      ),
      Promise.resolve(
        makeSuccessfulQuote({
          networkFee: 1_300_000n,
          simulation: { ...quoteSuccess.simulation, gasUsed: 1_300_000n },
        }),
      ),
    ];
    const output = await selectQuote({ strategy: "estimatedGas", quotes: pending });
    expect(output).toBeDefined();
    expect(output?.simulation.gasUsed).toBe(1_300_000n);
  }, 1_000);

  it("gas optimized prefers higher priority even if gas is worse", async () => {
    const pending = [
      Promise.resolve(
        makeSuccessfulQuote({
          networkFee: 900_000n,
          simulation: { ...quoteSuccess.simulation, gasUsed: 900_000n },
          activatedFeatures: [],
        }),
      ),
      Promise.resolve(
        makeSuccessfulQuote({
          networkFee: 1_200_000n,
          simulation: { ...quoteSuccess.simulation, gasUsed: 1_200_000n },
          activatedFeatures: ["integratorSurplus"] as AggregatorFeature[],
        }),
      ),
    ];
    const output = await selectQuote({ strategy: "estimatedGas", quotes: pending });
    expect(output).toBeDefined();
    expect(output?.simulation.gasUsed).toBe(1_200_000n);
  }, 1_000);

  it("priority selection sorts by priority then best price", async () => {
    const pending = [
      Promise.resolve(simulationFailure),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 15n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 15n },
          activatedFeatures: ["integratorFees", "integratorSurplus"] as AggregatorFeature[],
        }),
      ),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 30n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 30n },
          activatedFeatures: ["integratorFees"] as AggregatorFeature[],
        }),
      ),
    ];
    const output = await selectQuote({ strategy: "priority", quotes: pending });
    expect(output).toBeDefined();
    expect(output?.simulation.outputAmount).toBe(15n);
  }, 1_000);

  it("custom selection", async () => {
    const pending = [
      Promise.resolve(simulationFailure),
      Promise.resolve(makeSuccessfulQuote({ simulation: { ...quoteSuccess.simulation } })),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 30n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 30n },
        }),
      ),
    ];
    const output = await selectQuote({
      strategy: (quotes) =>
        Promise.all(quotes).then((resolved) => resolved[2] as SuccessfulSimulatedQuote),
      quotes: pending,
    });
    expect(output).toBeDefined();
    expect(output?.simulation.outputAmount).toBe(30n);
  }, 1_000);

  it("returns null if no successful quotes", async () => {
    const pending = [Promise.resolve(quoteFailure), Promise.resolve(simulationFailure)];
    const output = await selectQuote({ strategy: "bestPrice", quotes: pending });
    expect(output).toBeNull();
  });

  it("returns null if firstN cannot collect enough successful quotes", async () => {
    const pending = [Promise.resolve(quoteFailure), Promise.resolve(makeSuccessfulQuote({}))];
    const output = await selectQuote({
      strategy: {
        collect: { type: "firstN", count: 2 },
        rank: "bestPrice",
      },
      quotes: pending,
    });
    expect(output).toBeNull();
  });

  it("returns null if benchmark criteria are not met", async () => {
    const pending = [
      Promise.resolve(makeSuccessfulQuote({ provider: "odos", outputAmount: 20n })),
      Promise.resolve(quoteFailure),
    ];
    const output = await selectQuote({
      strategy: {
        collect: {
          type: "benchmark",
          provider: "fabric",
          minQuotes: 2,
        },
        rank: "bestPrice",
      },
      quotes: pending,
    });
    expect(output).toBeNull();
  });

  it("throws if args are bad", async () => {
    await expect(selectQuote({ strategy: "bestPrice", quotes: [] })).rejects.toThrow();
    await expect(
      selectQuote({
        strategy: {
          collect: { type: "firstN", count: 0 },
          rank: "bestPrice",
        },
        quotes: [Promise.resolve(quoteSuccess)],
      }),
    ).rejects.toThrow("Collector firstN count must be a positive integer");
    await expect(
      selectQuote({
        strategy: {
          collect: { type: "firstN", count: 2 },
          rank: "bestPrice",
        },
        quotes: [Promise.resolve(quoteSuccess)],
      }),
    ).rejects.toThrow("Collector firstN count cannot exceed the number of providers");
    await expect(
      selectQuote({
        strategy: {
          collect: { type: "benchmark", provider: "fabric", minQuotes: 0 },
          rank: "bestPrice",
        },
        quotes: [Promise.resolve(quoteSuccess)],
      }),
    ).rejects.toThrow("Collector benchmark minQuotes must be a positive integer");
    await expect(
      selectQuote({
        strategy: {
          collect: { type: "all" },
          rank: "first",
        },
        quotes: [Promise.resolve(quoteSuccess)],
      }),
    ).resolves.toBeDefined();
  });
});
