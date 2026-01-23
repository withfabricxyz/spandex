import { useMemo } from "react";
import { type Connector, useCapabilities, useConnection } from "wagmi";

export type WalletProperties = {
  batching: boolean; // Indicates if the wallet supports batching transactions
  injected: boolean; // Indicates if the wallet is injected (e.g., MetaMask)
  paymasterSupport: boolean; // Indicates if the wallet supports paymasters
};

/**
 * Custom hook to retrieve wallet properties such as batching capability and whether the wallet is injected.
 *
 * @param {Object} params - Parameters for the hook.
 * @param {number} params.chainId - The chain ID to check capabilities against.
 * @returns {WalletProperties} An object containing wallet properties.
 */
export function useWalletProperties({ chainId }: { chainId: number }) {
  const { address, connector } = useConnection();
  const { data: capabilities } = useCapabilities({
    account: address,
    chainId,
  });

  const properties = useMemo(() => {
    const result: WalletProperties = {
      batching: false,
      paymasterSupport: false,
      injected: isInjected(connector),
    };
    if (!capabilities || !address) return result;

    // biome-ignore lint/suspicious/noExplicitAny: <>
    const chainCapabilities: any = capabilities[chainId];
    if (chainCapabilities) {
      result.batching = chainCapabilities?.atomic?.status === "supported";
      result.paymasterSupport = chainCapabilities?.paymasterService?.supported === true;
    }

    return result;
  }, [capabilities, chainId, address, connector]);

  return properties;
}

function isInjected(connector?: Connector): boolean {
  // TODO: What else can we do here?
  return connector?.type === "injected" || connector?.type === "metaMask";
}
