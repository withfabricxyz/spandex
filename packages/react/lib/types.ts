import type { Config, ConfigParams } from "@spandex/core";

export type SpandexProviderProps = {
  config: ConfigParams;
  children: React.ReactNode;
};

export type SpandexContextValue = Config;
