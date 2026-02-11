import { useCallback } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { configuredChains } from "../config/onchain";

const supportedChainIds = configuredChains.map((c) => c.chain.id);
const defaultChainId = supportedChainIds[0];

export function useSupportedChain() {
  const { isConnected, chainId } = useConnection();
  const switchChain = useSwitchChain();

  const isWrongChain = isConnected && (!chainId || !supportedChainIds.includes(chainId));

  const ensureChain = useCallback(
    async (targetChainId: number = defaultChainId) => {
      await switchChain.mutateAsync({ chainId: targetChainId });
    },
    [switchChain],
  );

  return { isWrongChain, ensureChain };
}
