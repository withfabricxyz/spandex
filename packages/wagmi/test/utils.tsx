import { QueryClientProvider } from "@tanstack/react-query";
import {
  type RenderHookOptions,
  type RenderOptions,
  render as tlRender,
  renderHook as tlRenderHook,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { SmalProvider } from "../lib/context/SmalProvider.js";
import type { SmalProviderProps } from "../lib/types.js";
import { queryClient } from "./constants.js";

export const DEFAULT_TEST_CONFIG: SmalProviderProps["config"] = {
  providers: { fabric: {} },
  options: { strategy: "quotedPrice" },
};

export function createWrapper(config?: SmalProviderProps["config"]) {
  const smalConfig = config || DEFAULT_TEST_CONFIG;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SmalProvider config={smalConfig}>{children}</SmalProvider>
      </QueryClientProvider>
    );
  };
}

export function renderHook<Result, Props>(
  hook: (props: Props) => Result,
  options?: RenderHookOptions<Props> & {
    smalConfig?: SmalProviderProps["config"];
  },
) {
  const { smalConfig, ...renderOptions } = options || {};

  return tlRenderHook(hook, {
    wrapper: createWrapper(smalConfig),
    ...renderOptions,
  });
}

export function render(
  ui: React.ReactElement,
  options?: RenderOptions & {
    smalConfig?: SmalProviderProps["config"];
  },
) {
  const { smalConfig, ...renderOptions } = options || {};

  return tlRender(ui, {
    wrapper: createWrapper(smalConfig),
    ...renderOptions,
  });
}

export { screen, waitFor, within } from "@testing-library/react";
