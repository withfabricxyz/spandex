import { buildMetaAggregator } from "@withfabric/smal";

export const metaAggregator = buildMetaAggregator({
  providers: {
    fabric: {},
    odos: { referralCode: 1234 },
    kyberswap: { clientId: "your client id" },
    // "0x": { apiKey: "YOUR_ZEROX_API_KEY" },
  },
  options: {
    deadlineMs: 5_000,
    integratorFeeAddress: "0xFee00000000000000000000000000000000000fee",
    integratorSwapFeeBps: 25,
  },
});
