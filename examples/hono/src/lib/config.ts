import { createConfig, defaultProviders } from "@withfabric/spandex";
import { createPublicClient, fallback, http, type PublicClient, type Transport } from "viem";
import { base, unichain } from "viem/chains";

// Configuration options
const appId = process.env.APP_ID ?? "spandex-hono";
const ankrApiKey = process.env.ANKR_API_KEY;
const infuraApiKey = process.env.INFURA_API_KEY;
const alchemyApiKey = process.env.ALCHEMY_API_KEY;

// Enabled chains
const chains = [base, unichain];

// Provider URL generation based on environment variables
function getProviderTransport(chain: (typeof chains)[number]): Transport {
  const urls: string[] = [];
  if (ankrApiKey) {
    switch (chain.id) {
      case base.id:
        urls.push(`https://rpc.ankr.com/base/${ankrApiKey}`);
        break;
      case unichain.id:
        urls.push(`https://rpc.ankr.com/unichain/${ankrApiKey}`);
        break;
    }
  }
  if (infuraApiKey) {
    switch (chain.id) {
      case unichain.id:
        urls.push(`https://unichain.infura.io/v3/${infuraApiKey}`);
        break;
      case base.id:
        urls.push(`https://base-mainnet.infura.io/v3/${infuraApiKey}`);
        break;
    }
  }
  if (alchemyApiKey) {
    switch (chain.id) {
      case unichain.id:
        urls.push(`https://unichain.alchemyapi.io/v2/${alchemyApiKey}`);
        break;
      case base.id:
        urls.push(`https://base-mainnet.alchemyapi.io/v2/${alchemyApiKey}`);
        break;
    }
  }

  if (urls.length === 0) {
    return http(); // This may result in rate limiting or providers which disable eth_simulateV2 for free tiers
  }

  if (urls.length === 1) {
    return http(urls[0]);
  }

  return fallback(urls.map((url) => http(url)));
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
