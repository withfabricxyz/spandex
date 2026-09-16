import { createConfig, defaultProviders } from "@spandex/core";
import { createPublicClient, http, type PublicClient, type Transport } from "viem";
import { base, unichain } from "viem/chains";

// Configuration options
const appId = process.env.APP_ID ?? "spandex-hono";
const drpcApiKey = process.env.DRPC_API_KEY;

// Enabled chains
const chains = [base, unichain];

function getProviderTransport(chain: (typeof chains)[number]): Transport {
  const network = chain.id === base.id ? "base" : "unichain";
  return http(
    drpcApiKey
      ? `https://lb.drpc.live/${network}/${encodeURIComponent(drpcApiKey)}`
      : `https://${network}.drpc.org`,
  );
}

function getProvider(chain: (typeof chains)[number]) {
  const transport = getProviderTransport(chain);
  return createPublicClient({
    chain,
    transport,
  });
}

const clients: PublicClient[] = chains.map((chain) => getProvider(chain)) as PublicClient[];

export const config = createConfig({
  providers: defaultProviders({ appId }),
  options: {
    deadlineMs: 10_000,
  },
  clients: clients as PublicClient[],
});
