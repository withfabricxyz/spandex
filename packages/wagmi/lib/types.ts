import type { AggregatorConfig, MetaAggregationOptions, MetaAggregator } from "@withfabric/smal";

export type SmalProviderProps = {
  config: {
    aggregators: AggregatorConfig[];
    defaults?: MetaAggregationOptions;
  };
  children: React.ReactNode;
};

export type SmalContextValue = {
  metaAggregator: MetaAggregator;
};
