import { newStream, prepareQuotes, type Quote, quoteStreamErrorHandler } from "@spandex/core";
import { createFileRoute } from "@tanstack/react-router";
import { getProxyConfig, parseSwapFromRequest, quoteQuerySchema } from "./quoteProxy";

export const Route = createFileRoute("/api/prepareQuotes")({
  validateSearch: (search) => quoteQuerySchema.parse(search),
  server: {
    handlers: {
      GET: async ({ request }) => {
        const swap = parseSwapFromRequest(request);
        const promises = await prepareQuotes<Quote>({
          swap,
          config: getProxyConfig(),
          mapFn: (quote: Quote) => Promise.resolve(quote),
        });
        return new Response(newStream(promises, quoteStreamErrorHandler));
      },
    },
  },
});
