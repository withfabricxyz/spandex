import { describe, expect, it } from "bun:test";
import { defaultSwapParams, recordDefaultSimulation, recordOutput } from "../../test/utils.js";
import { VeloraAggregator, velora } from "./velora.js";

describe("Velora", () => {
  it("generates a quote", async () => {
    const quoter = new VeloraAggregator();
    const quote = await quoter.fetchQuote(defaultSwapParams);
    expect(quote).toBeDefined();
    expect(quote.provider).toBe("velora");

    if (quote.provider !== "velora") {
      throw new Error("Unexpected provider");
    }

    if (quote.success) {
      expect(quote.outputAmount).toBeGreaterThan(0n);
      expect(quote.networkFee).toBeGreaterThan(0n);
      expect(quote.txData).toBeDefined();
      expect(quote.txData.to).toBeDefined();
      expect(quote.txData.data).toBeDefined();
    }
  }, 30_000);

  it("simulates a swap - recorded", async () => {
    const quote = await recordDefaultSimulation(velora());
    expect(quote).toBeDefined();
    expect(quote.simulation.outputAmount).toBeGreaterThan(0n);
    expect(quote.simulation.gasUsed).toBeGreaterThan(0);
    expect(quote.simulation.latency).toBeGreaterThan(0);
    expect(quote.performance.accuracy).toBeCloseTo(1.9, 0.01);
  }, 30_000);

  it("toggles fees", async () => {
    const quote = await recordOutput("velora/fees", async () => {
      return velora({ partner: "friend" }).fetchQuote(defaultSwapParams, {
        integratorSwapFeeBps: 10,
        integratorFeeAddress: "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055",
      });
    }).then((r) => r.result);
    if (!quote?.success || quote.provider !== "velora") {
      throw new Error("Failed to fetch quote");
    }
    expect(quote.details.priceRoute.partnerFee).toBe(0.1);
    expect(quote.details.priceRoute.partner).toBe("friend");
  }, 30_000);
});
