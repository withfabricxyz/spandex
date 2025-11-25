import { buildMetaAggregator } from "@withfabric/smal";

export const metaAggregator = buildMetaAggregator({
  providers: {
    fabric: {},
    "0x": { apiKey: "YOUR_ZEROX_API_KEY" },
    odos: { referralCode: 1234 },
  },
  options: {
    deadlineMs: 10000,
  },
});
