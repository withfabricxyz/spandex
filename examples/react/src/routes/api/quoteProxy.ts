import {
  createConfig,
  deserializeWithBigInt,
  fynd,
  kyberswap,
  mobula,
  nordstern,
  type SimulationOptions,
  type SwapParams,
} from "@spandex/core";
import { createServerOnlyFn } from "@tanstack/react-start";
import { createPublicClient, http } from "viem";
import { z } from "zod";
import { configuredChains } from "@/config/onchain";

export const getProxyConfig = createServerOnlyFn(() =>
  createConfig({
    providers: [
      nordstern({}),
      kyberswap({ clientId: "spandex_ui" }),
      process.env.FYND_API_KEY ? fynd({ apiKey: process.env.FYND_API_KEY }) : undefined,
      process.env.MOBULA_API_KEY ? mobula({ apiKey: process.env.MOBULA_API_KEY }) : undefined,
    ].filter((p): p is NonNullable<typeof p> => Boolean(p)),
    options: {
      deadlineMs: 5_000,
    },
    clients: configuredChains.map((c) =>
      createPublicClient({
        ...c,
        transport: process.env.DRPC_API_KEY
          ? http(`https://lb.drpc.live/base/${encodeURIComponent(process.env.DRPC_API_KEY)}`, {
              batch: true,
            })
          : c.transport,
      }),
    ),
  }),
);

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
