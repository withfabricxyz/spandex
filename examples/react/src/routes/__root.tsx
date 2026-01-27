import { proxy } from "@spandex/core";
import { SpandexProvider } from "@spandex/react";
import type { QueryClient } from "@tanstack/react-query";
import {
  ClientOnly,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Tooltip } from "radix-ui";
import { DialogPortal } from "@/components/Dialog";
import { Header } from "@/components/Header";
import { ToastPortal } from "@/components/Toast";
import { TokenSelectProvider } from "@/providers/TokenSelectProvider";
import { Web3Provider } from "@/providers/Web3Provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Spandex React Example",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
        type: "image/x-icon",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
    scripts: [
      {
        // prevent flash of default theme if user has other theme selected
        src: "/theme-init.js",
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClientOnly>
          <Web3Provider>
            <SpandexProvider
              config={{
                proxy: proxy({ pathOrUrl: "/api/quotes" }),
              }}
            >
              <Tooltip.Provider>
                <TokenSelectProvider>
                  <Header />
                  <div className="pt-80 pb-20 max-w-360 mx-auto">{children}</div>
                  <DialogPortal />
                </TokenSelectProvider>
              </Tooltip.Provider>
              <ToastPortal />
            </SpandexProvider>
          </Web3Provider>
        </ClientOnly>
        <Scripts />
      </body>
    </html>
  );
}
