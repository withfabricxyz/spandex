import {
  createConfig,
  fabric,
  kyberswap,
  newQuoteStream,
  odos,
  prepareQuotes,
  type Quote,
  type SwapParams,
  zeroX,
} from "@spandex/core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Server side config for fetching quotes
const config = createConfig({
  providers: [
    odos({}),
    kyberswap({ clientId: "spandex_ui" }),
    fabric({ appId: "spandex_ui" }),
    process.env.ZEROX_API_KEY ? zeroX({ apiKey: process.env.ZEROX_API_KEY }) : undefined,
  ].filter((p): p is NonNullable<typeof p> => Boolean(p)),
  options: {
    deadlineMs: 5_000,
  },
});

const addressSchema = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val);
});

const baseSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  inputToken: addressSchema,
  outputToken: addressSchema,
  slippageBps: z.coerce.number().int().nonnegative().max(10000),
  swapperAccount: addressSchema,
  recipientAccount: addressSchema.optional(),
});

const querySchema = z.discriminatedUnion("mode", [
  baseSchema.extend({
    mode: z.literal("exactIn"),
    inputAmount: z.coerce.bigint().positive(),
  }),
  baseSchema.extend({
    mode: z.literal("targetOut"),
    outputAmount: z.coerce.bigint().positive(),
  }),
]);

export const Route = createFileRoute("/api/quotes")({
  validateSearch: (search) => querySchema.parse(search),
  server: {
    handlers: {
      GET: async ({ request }) => {
        const swap = querySchema.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ) satisfies SwapParams;
        const promises = await prepareQuotes<Quote>({
          swap,
          config,
          mapFn: (quote: Quote) => Promise.resolve(quote),
        });
        return new Response(newQuoteStream(promises));
      },
    },
  },
});
