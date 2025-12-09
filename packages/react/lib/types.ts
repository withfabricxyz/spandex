import type { Config, ConfigParams } from "@withfabric/spandex";

export type SpandexProviderProps = {
  config: ConfigParams;
  children: React.ReactNode;
};

export type SpandexContextValue = Config;
