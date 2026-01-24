import { QueryClientProvider } from "@tanstack/react-query";
import {
  type RenderHookOptions,
  type RenderOptions,
  render as tlRender,
  renderHook as tlRenderHook,
} from "@testing-library/react";
import { fabric } from "@withfabric/spandex";
import type { ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { SpandexProvider } from "../lib/context/SpandexProvider.js";
import type { SpandexProviderProps } from "../lib/types.js";
import { queryClient } from "./constants.js";

const wagmiConfig = createConfig({
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});

export const DEFAULT_TEST_CONFIG: SpandexProviderProps["config"] = {
  providers: [fabric({ appId: "test" })],
};

export function createWrapper(config?: SpandexProviderProps["config"]) {
  const spandexConfig = config || DEFAULT_TEST_CONFIG;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <SpandexProvider config={spandexConfig}>{children}</SpandexProvider>
        </WagmiProvider>
      </QueryClientProvider>
    );
  };
}

export function renderHook<Result, Props>(
  hook: (props: Props) => Result,
  options?: RenderHookOptions<Props> & {
    spandexConfig?: SpandexProviderProps["config"];
  },
) {
  const { spandexConfig, ...renderOptions } = options || {};

  return tlRenderHook(hook, {
    wrapper: createWrapper(spandexConfig),
    ...renderOptions,
  });
}

export function render(
  ui: React.ReactElement,
  options?: RenderOptions & {
    spandexConfig?: SpandexProviderProps["config"];
  },
) {
  const { spandexConfig, ...renderOptions } = options || {};

  return tlRender(ui, {
    wrapper: createWrapper(spandexConfig),
    ...renderOptions,
  });
}

export { screen, waitFor, within } from "@testing-library/react";
