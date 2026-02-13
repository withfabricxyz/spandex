import { useCallback } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { configuredChains } from "../config/onchain";

const supportedChainIds = configuredChains.map((c) => c.chain.id);
const defaultChainId = supportedChainIds[0];

export function useSupportedChain() {
  const { isConnected, isReconnecting, chainId } = useConnection();
  const switchChain = useSwitchChain();

  // Don't trust chainId during reconnection — wagmi may briefly report the
  // configured default chain before the wallet responds with the real one.
  const isChainReady = isConnected && !isReconnecting;
  const isSupportedChain = isChainReady && !!chainId && supportedChainIds.includes(chainId);

  const ensureChain = useCallback(
    async (targetChainId: number = defaultChainId) => {
      await switchChain.mutateAsync({ chainId: targetChainId });
    },
    [switchChain],
  );

  return { isSupportedChain, ensureChain };
}
