import type { Chain } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { coinbaseWallet, injected, safe, walletConnect } from "wagmi/connectors";
import { configuredChains } from "../config/onchain";

const projectId = "24d9e4b37d24c4299a623e063e8ab853";
export const config = createConfig({
  chains: configuredChains.map(({ chain }) => chain) as [Chain, ...Chain[]],
  connectors: [injected(), walletConnect({ projectId }), safe(), coinbaseWallet()],
  transports: Object.fromEntries(
    configuredChains.map(({ chain, transport }) => [chain.id, transport]),
  ),
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
