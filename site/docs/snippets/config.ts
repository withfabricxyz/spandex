import { createConfig, fabric, kyberswap, nordstern } from "@spandex/core";
import { createPublicClient, http, type PublicClient } from "viem";
import { base } from "viem/chains";

// Create a base client for quote simulation
const baseClient = createPublicClient({
  chain: base,
  transport: http("https://base.drpc.org"),
});

export const config = createConfig({
  providers: [
    fabric({ appId: "your app id" }),
    nordstern({}),
    kyberswap({ clientId: "your client id" }),
  ],
  options: {
    deadlineMs: 5_000,
    integratorFeeAddress: "0xFee00000000000000000000000000000000000fee",
    integratorSwapFeeBps: 25,
  },
  clients: [baseClient] as PublicClient[],
});
