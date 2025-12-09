import type { MetaAggregator, MetaAggregatorConfig } from "@withfabric/spandex";

export type SpandexProviderProps = {
  config: MetaAggregatorConfig;
  children: React.ReactNode;
};

export type SpandexContextValue = {
  metaAggregator: MetaAggregator;
};
