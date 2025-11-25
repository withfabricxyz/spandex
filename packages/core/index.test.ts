import { describe, expect, it } from "bun:test";
import { buildMetaAggregator, defaultMetaAggregator } from "./index.js";

describe("Provider configuration", () => {
  it("builds a default meta-aggregator", async () => {
    const aggregator = defaultMetaAggregator();
    expect(aggregator).toBeDefined();
    expect(aggregator.providers.length).toBeGreaterThanOrEqual(1);
  });

  it("supports manual configuration", async () => {
    const aggregator = buildMetaAggregator({
      providers: {
        "0x": {
          apiKey: "test",
        },
      },
    });

    expect(aggregator).toBeDefined();
    expect(aggregator.providers.length).toEqual(1);
    expect(aggregator.providers[0]).toEqual("0x");
  });
});
