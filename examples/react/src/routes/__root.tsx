import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { SpandexProvider } from "@withfabric/spandex-react";
import { Header } from "@/components/Header";
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
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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
        <Web3Provider>
          <SpandexProvider
            config={{
              providers: {
                odos: {},
                kyberswap: { clientId: "spandex_ui" },
              },
            }}
          >
            <TokenSelectProvider>
              <Header />
              <div className="pt-80 pb-20 max-w-[614px] mx-auto">{children}</div>
              <div id="dialog-root" />
            </TokenSelectProvider>
          </SpandexProvider>
        </Web3Provider>
        <Scripts />
      </body>
    </html>
  );
}
