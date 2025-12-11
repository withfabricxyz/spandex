import { createConfig } from "@withfabric/spandex";
import { createContext, useContext, useMemo } from "react";
import type { PublicClient } from "viem";
import { useConfig } from "wagmi";
import type { SpandexContextValue, SpandexProviderProps } from "../types.js";

export const SpandexContext = createContext<SpandexContextValue | null>(null);

export function SpandexProvider({ config, children }: SpandexProviderProps) {
  const { providers, options } = config;
  const { getClient } = useConfig();

  const spandexConfig = useMemo(() => {
    return createConfig({
      providers,
      options,
      clients: (chainId: number) => getClient({ chainId }) as PublicClient | undefined,
    });
  }, [providers, options, getClient]);

  const contextValue: SpandexContextValue = useMemo(() => spandexConfig, [spandexConfig]);

  return <SpandexContext.Provider value={contextValue}>{children}</SpandexContext.Provider>;
}

export function useSpandexConfig() {
  const context = useContext(SpandexContext);

  if (!context) {
    throw new Error("useSpandexConfig must be used within a SpandexProvider");
  }

  return context;
}
