import { describe, expect, it } from "bun:test";
import type { FabricQuoteResponse } from "./aggregators/fabric.js";
import { selectQuote } from "./selectQuote.js";
import type { SimulatedQuote, SimulationSuccess, SuccessfulSimulatedQuote } from "./types.js";

const baseSimulation: SimulationSuccess = {
  success: true,
  outputAmount: 900_000n,
  callsResults: [] as SimulationSuccess["callsResults"],
  latency: 0,
  gasUsed: 5_000n,
  blockNumber: 0n,
  transfers: [],
};

const quoteSuccess: SuccessfulSimulatedQuote = {
  success: true,
  provider: "fabric",
  details: {} as FabricQuoteResponse,
  latency: 100,
  inputAmount: 1_000_000n,
  outputAmount: 900_000n,
  networkFee: 5_000n,
  txData: { to: "0x0", data: "0x0" },
  simulation: baseSimulation,
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

  it("priority selection (used for failover)", async () => {
    const pending = [
      Promise.resolve(simulationFailure),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 15n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 15n },
        }),
      ),
      Promise.resolve(
        makeSuccessfulQuote({
          outputAmount: 30n,
          simulation: { ...quoteSuccess.simulation, outputAmount: 30n },
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

  it("throws if args are bad", async () => {
    await expect(selectQuote({ strategy: "bestPrice", quotes: [] })).rejects.toThrow();
  });
});
