import { buildMetaAggregator } from "@withfabric/spandex";
import { createContext, useContext, useMemo } from "react";
import type { SpandexContextValue, SpandexProviderProps } from "../types.js";

export const SpandexContext = createContext<SpandexContextValue | null>(null);

export function SpandexProvider({ config, children }: SpandexProviderProps) {
  const { providers, options } = config;

  const metaAggregator = useMemo(() => {
    return buildMetaAggregator({ providers, options });
  }, [providers, options]);

  const contextValue: SpandexContextValue = useMemo(
    () => ({
      metaAggregator,
    }),
    [metaAggregator],
  );

  return <SpandexContext.Provider value={contextValue}>{children}</SpandexContext.Provider>;
}

export function useSpandexConfig() {
  const context = useContext(SpandexContext);

  if (!context) {
    throw new Error("useSpandexConfig must be used within a SpandexProvider");
  }

  const { metaAggregator } = context;

  return {
    metaAggregator,
  };
}
