import { describe, expect, it } from "bun:test";
import { recordOutput, usdcBalanceSwap } from "../../test/utils.js";
import type { SimulatedQuote, SuccessfulSimulatedQuote } from "../types.js";
import { spandexCloud } from "./proxy.js";

describe("spandexCloud", () => {
  const cloud = spandexCloud({ apiKey: "testing" });

  it("gets simulated quotes - recorded", async () => {
    const quotes = await recordOutput<SimulatedQuote[]>(
      "spandex-cloud/get_quotes-base-usdc-to-weth",
      async () => {
        return cloud.getQuotes(usdcBalanceSwap);
      },
    ).then((r) => r.result);

    expect(quotes).toBeDefined();
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThan(0);

    for (const quote of quotes) {
      expect(quote.provider).toBeDefined();
      expect(quote.simulation).toBeDefined();
      expect(typeof quote.simulation.success).toBe("boolean");
    }
  }, 30_000);

  it("gets a selected simulated quote - recorded", async () => {
    const quote = await recordOutput<SuccessfulSimulatedQuote | null>(
      "spandex-cloud/get_quote-base-usdc-to-weth-fastest",
      async () => {
        return cloud.getQuote(usdcBalanceSwap, "fastest");
      },
    ).then((r) => r.result);

    expect(quote).toBeDefined();
    expect(quote).not.toBeNull();

    if (!quote) {
      throw new Error("Expected a selected quote from spanDEX Cloud.");
    }

    expect(quote.provider).toBeDefined();
    expect(quote.simulation).toBeDefined();
    expect(typeof quote.simulation.success).toBe("boolean");
  }, 30_000);
});
