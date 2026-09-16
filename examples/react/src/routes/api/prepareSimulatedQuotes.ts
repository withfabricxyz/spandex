import { newStream, prepareSimulatedQuotes, simulatedQuoteStreamErrorHandler } from "@spandex/core";
import { createFileRoute } from "@tanstack/react-router";
import {
  getProxyConfig,
  parseSimulationOptionsFromRequest,
  parseSwapFromRequest,
  quoteQuerySchema,
} from "./quoteProxy";

export const Route = createFileRoute("/api/prepareSimulatedQuotes")({
  validateSearch: (search) => quoteQuerySchema.parse(search),
  server: {
    handlers: {
      GET: async ({ request }) => {
        const swap = parseSwapFromRequest(request);
        const simulationOptions = parseSimulationOptionsFromRequest(request);
        const promises = await prepareSimulatedQuotes({
          swap,
          config: getProxyConfig(),
          simulationOptions,
        });
        return new Response(newStream(promises, simulatedQuoteStreamErrorHandler));
      },
    },
  },
});
