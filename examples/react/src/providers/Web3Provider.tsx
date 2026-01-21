import type { Chain } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { coinbaseWallet, injected, safe, walletConnect } from "wagmi/connectors";
import { configuredChains } from "../config/onchain";

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;
const connectors = [
  injected(),
  ...(projectId ? [walletConnect({ projectId })] : []),
  safe(),
  coinbaseWallet(),
];

const config = createConfig({
  chains: configuredChains.map(({ chain }) => chain) as [Chain, ...Chain[]],
  connectors,
  transports: Object.fromEntries(
    configuredChains.map(({ chain, transport }) => [chain.id, transport]),
  ),
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
