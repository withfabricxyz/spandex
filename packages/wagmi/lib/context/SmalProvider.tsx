import { buildMetaAggregator } from "@withfabric/smal";
import { createContext, useContext, useMemo } from "react";
import type { SmalContextValue, SmalProviderProps } from "../types.js";

export const SmalContext = createContext<SmalContextValue | null>(null);

export function SmalProvider({ config, children }: SmalProviderProps) {
  const { aggregators, defaults } = config;

  const metaAggregator = useMemo(() => {
    return buildMetaAggregator({ aggregators, defaults });
  }, [aggregators, defaults]);

  const contextValue: SmalContextValue = useMemo(
    () => ({
      metaAggregator,
    }),
    [metaAggregator],
  );

  return <SmalContext.Provider value={contextValue}>{children}</SmalContext.Provider>;
}

export function useSmalConfig() {
  const context = useContext(SmalContext);

  if (!context) {
    throw new Error("useSmalConfig must be used within a SmalProvider");
  }

  const { metaAggregator } = context;

  return {
    metaAggregator,
  };
}
