import { describe, expect, it } from "bun:test";
import { buildMetaAggregator, defaultMetaAggregator } from ".";

describe("Provider configuration", () => {
  it("builds a default meta-aggregator", async () => {
    const aggregator = defaultMetaAggregator();
    expect(aggregator).toBeDefined();
    expect(aggregator.providers.length).toBeLessThanOrEqual(5);
    expect(aggregator.providers.length).toBeGreaterThanOrEqual(2);
  });

  it("supports manual configuration", async () => {
    const aggregator = buildMetaAggregator({
      aggregators: [
        {
          provider: "0x",
          config: {
            apiKey: "test",
          },
        },
      ],
    });

    expect(aggregator).toBeDefined();
    expect(aggregator.providers.length).toEqual(1);
  });
});
