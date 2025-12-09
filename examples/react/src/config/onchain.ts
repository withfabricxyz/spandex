import { type Chain, createPublicClient } from "viem";
import { fallback, http } from "wagmi";
import { base, anvil as importedAnvil } from "wagmi/chains";

const anvil = {
  ...importedAnvil,
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "http://localhost:1337",
    },
  },
};

// Single configuration of multiple chains
export type ChainConfig = {
  chain: Chain;
  transport: ReturnType<typeof http | typeof fallback>;
  executorBlockNumber?: bigint; // Optional block number for the executor
};

export const configuredChains: ChainConfig[] = [
  {
    chain: anvil,
    transport: http(),
    executorBlockNumber: BigInt(process.env.ANVIL_FORK_BLOCK_NUMBER || "0"),
  },
  {
    chain: base,
    transport: fallback([
      http("https://base-mainnet.g.alchemy.com/v2/u3G90yf_agQOdp1J7f5foTvlpCHM34dn"),
      http(
        "https://crimson-powerful-needle.base-mainnet.quiknode.pro/11385ca7c730e796cacc80fea42129adadc9b6d4",
      ),
    ]),
  },
];

export function mapChainId(chainId: number): number {
  return mappedChains[chainId] || chainId;
}

export function getChainConfig(chainId: number): ChainConfig {
  const mappedId = mapChainId(chainId);
  const chainConfig = configuredChains.find((c) => c.chain.id === mappedId);
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chainConfig;
}

export function getPublicClient(chainId: number) {
  const { chain, transport } = getChainConfig(chainId);
  return createPublicClient({
    chain,
    transport,
  });
}

function getExplorerBaseUrl(chainId: number): string | undefined {
  try {
    return getChainConfig(chainId).chain.blockExplorers?.default?.url;
  } catch (_err) {
    return undefined;
  }
}

export function getExplorerUrl(
  chainId: number,
  type: "tx" | "address" | "block",
  value: number | string,
): string | undefined {
  const baseUrl = getExplorerBaseUrl(chainId);
  return baseUrl ? `${baseUrl}/${type}/${value}` : undefined;
}

export function getExplorerLink(
  chainId: number,
  type: "tx" | "address" | "block",
  value: number | string,
): { href: string; label: string; openInNewTab?: boolean } | undefined {
  const url = getExplorerUrl(chainId, type, value);
  if (!url) return undefined;
  return {
    href: url,
    label: `View ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    openInNewTab: true,
  };
}

const mappedChains = Object.fromEntries(
  (process.env.ANVIL_MAPPED_CHAIN_IDS || "").split(",").map((id) => [id, anvil.id]),
);
