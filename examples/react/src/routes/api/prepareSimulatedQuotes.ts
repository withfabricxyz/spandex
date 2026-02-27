import { newStream, prepareSimulatedQuotes, simulatedQuoteStreamErrorHandler } from "@spandex/core";
import { createFileRoute } from "@tanstack/react-router";
import { parseSwapFromRequest, proxyConfig, quoteQuerySchema } from "./quoteProxy";

export const Route = createFileRoute("/api/prepareSimulatedQuotes")({
  validateSearch: (search) => quoteQuerySchema.parse(search),
  server: {
    handlers: {
      GET: async ({ request }) => {
        const swap = parseSwapFromRequest(request);
        const promises = await prepareSimulatedQuotes({
          swap,
          config: proxyConfig,
        });
        return new Response(newStream(promises, simulatedQuoteStreamErrorHandler));
      },
    },
  },
});
