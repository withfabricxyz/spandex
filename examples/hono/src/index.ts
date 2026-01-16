import { zValidator } from "@hono/zod-validator";
import {
  getQuote,
  newQuoteStream,
  prepareQuotes,
  type Quote,
  type SwapParams,
  serializeWithBigInt,
} from "@withfabric/spandex";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import { config } from "./lib/config";

const app = new Hono();

////////////// Validation Schemas //////////////

const addressSchema = z.custom<`0x${string}`>((val) => {
  return typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val);
});

const baseSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  inputToken: addressSchema,
  outputToken: addressSchema,
  slippageBps: z.coerce.number().int().nonnegative().max(10000),
  swapperAccount: addressSchema,
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

////////////// Routes //////////////

app.get("/quotes/select", zValidator("query", querySchema), async (c) => {
  const swap = c.req.valid("query") satisfies SwapParams;
  const quote = await getQuote({
    swap,
    config,
    strategy: "fastest",
  });
  // Quite a few bigint values in the quote response, so we use our custom serializer
  c.header("Content-Type", "application/json");
  return c.body(serializeWithBigInt(quote));
});

// Stream raw quotes as they are fetched
app.get("/quotes/stream", zValidator("query", querySchema), async (c) => {
  const swap = c.req.valid("query") satisfies SwapParams;
  return stream(c, async (stream) => {
    const prepared = prepareQuotes<Quote>({
      swap,
      config,
      mapFn: (quote: Quote) => Promise.resolve(quote), // No-op mapper to get raw quotes
    });
    await stream.pipe(newQuoteStream(prepared));
  });
});

app.get("/", (c) => {
  const params = new URLSearchParams({
    chainId: "8453",
    inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    outputToken: "0x4200000000000000000000000000000000000006",
    mode: "exactIn",
    inputAmount: "1000000",
    slippageBps: "100",
    swapperAccount: "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055",
  }).toString();
  return c.html(`<a href="/quotes/select?${params}">Get a quote at /quotes/select</a>`);
});

export default app;
