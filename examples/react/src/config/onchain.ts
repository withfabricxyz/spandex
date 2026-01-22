import type { Chain } from "viem";
import { fallback, http } from "wagmi";
import { base } from "wagmi/chains";

// allow VITE_RPC_URLS to be a comma-separated list of URLs for fallback purposes
// falls back to default if none provided
const RPC_URLS = (import.meta.env.VITE_RPC_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

// Single configuration of multiple chains
type ChainConfig = {
  chain: Chain;
  transport: ReturnType<typeof http | typeof fallback>;
  executorBlockNumber?: bigint; // Optional block number for the executor
};

export const configuredChains: ChainConfig[] = [
  {
    chain: base,
    transport: fallback(RPC_URLS.length > 0 ? RPC_URLS.map((url) => http(url)) : [http()]),
  },
];

function getChainConfig(chainId: number): ChainConfig {
  const chainConfig = configuredChains.find((c) => c.chain.id === chainId);
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chainConfig;
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
