import type { MetaAggregator, MetaAggregatorConfig } from "@withfabric/smal";

export type SmalProviderProps = {
  config: MetaAggregatorConfig;
  children: React.ReactNode;
};

export type SmalContextValue = {
  metaAggregator: MetaAggregator;
};
