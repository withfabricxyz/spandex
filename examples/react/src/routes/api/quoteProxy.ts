import {
  createConfig,
  defaultProviders,
  deserializeWithBigInt,
  o1,
  type SimulationOptions,
  type SwapParams,
  zeroX,
} from "@spandex/core";
import { createPublicClient } from "viem";
import { z } from "zod";
import { configuredChains } from "@/config/onchain";

export const proxyConfig = createConfig({
  providers: [
    ...defaultProviders({
      appId: "spandex_ui",
    }),
    process.env.O1_BASE_URL && process.env.O1_API_KEY
      ? o1({ baseUrl: process.env.O1_BASE_URL, apiKey: process.env.O1_API_KEY })
      : undefined,
    process.env.ZEROX_API_KEY ? zeroX({ apiKey: process.env.ZEROX_API_KEY }) : undefined,
  ].filter((p): p is NonNullable<typeof p> => Boolean(p)),
  options: {
    deadlineMs: 5_000,
  },
  clients: configuredChains.map((c) => createPublicClient(c)),
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
  simulationOptions: z.string().optional(),
});

export const quoteQuerySchema = z.discriminatedUnion("mode", [
  baseSchema.extend({
    mode: z.literal("exactIn"),
    inputAmount: z.coerce.bigint().positive(),
  }),
  baseSchema.extend({
    mode: z.literal("targetOut"),
    outputAmount: z.coerce.bigint().positive(),
  }),
]);

export function parseSwapFromRequest(request: Request): SwapParams {
  const { simulationOptions: _, ...swap } = parseQuoteQuery(request);
  return swap;
}

export function parseSimulationOptionsFromRequest(request: Request): SimulationOptions | undefined {
  const { simulationOptions } = parseQuoteQuery(request);
  return simulationOptions
    ? deserializeWithBigInt<SimulationOptions>(simulationOptions)
    : undefined;
}

function parseQuoteQuery(request: Request) {
  return quoteQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
}
