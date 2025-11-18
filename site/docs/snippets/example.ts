import { buildMetaAggregator } from "@withfabric/smal";

const agg = buildMetaAggregator({
  aggregators: [
    {
      provider: "0x",
      config: {
        apiKey: "...",
      },
    },
    {
      provider: "fabric",
      config: {},
    },
  ],
});