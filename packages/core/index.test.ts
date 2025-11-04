import { describe, expect, it } from "bun:test";
import type { PublicClient } from "viem";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { buildMetaAggregator, defaultMetaAggregator } from ".";

const client = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
}) as PublicClient;

describe("Provider configuration", () => {
  it("builds a default meta-aggregator", async () => {
    const aggregator = defaultMetaAggregator(client);
    expect(aggregator).toBeDefined();
    expect(aggregator.providers.length).toBeLessThanOrEqual(5);
    expect(aggregator.providers.length).toBeGreaterThanOrEqual(2);
  });

  it("supports manual configuration", async () => {
    const aggregator = buildMetaAggregator(
      {
        aggregators: [
          {
            provider: "0x",
            config: {
              apiKey: "test",
            },
          },
        ],
      },
      client,
    );

    expect(aggregator).toBeDefined();
    expect(aggregator.providers.length).toEqual(1);
  });
});
