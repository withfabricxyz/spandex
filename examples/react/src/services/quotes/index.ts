import { createServerFn } from "@tanstack/react-start";
import { createConfig, getQuotes, type SwapParams } from "@withfabric/spandex";
import { defaultProviders } from "@withfabric/spandex/lib/createConfig";
import type { Address } from "viem";
import { getPublicClient } from "@/config/onchain";

const config = createConfig({
  providers: {
    ...defaultProviders({
      appId: "spandex_ui",
    }),
  },
  clientLookup: (chainId) => getPublicClient(chainId),
});

type QuotesRequestBase = {
  chainId: number;
  inputToken: Address;
  outputToken: Address;
  slippageBps: number;
  swapperAccount: Address;
};

type QuotesRequest =
  | (QuotesRequestBase & { mode: "exactIn"; inputAmount: string })
  | (QuotesRequestBase & { mode: "targetOut"; outputAmount: string });

export const getQuotesServerFn = createServerFn({ method: "GET" })
  .inputValidator((input: QuotesRequest) => input)
  .handler(async ({ data }) => {
    const params: SwapParams =
      data.mode === "exactIn"
        ? {
            chainId: data.chainId,
            inputToken: data.inputToken,
            outputToken: data.outputToken,
            slippageBps: data.slippageBps,
            swapperAccount: data.swapperAccount,
            mode: "exactIn",
            inputAmount: BigInt(data.inputAmount),
          }
        : {
            chainId: data.chainId,
            inputToken: data.inputToken,
            outputToken: data.outputToken,
            slippageBps: data.slippageBps,
            swapperAccount: data.swapperAccount,
            mode: "targetOut",
            outputAmount: BigInt(data.outputAmount),
          };

    const quotes = await getQuotes({
      config,
      params,
    });

    // TODO: hack; solves serialization issues with bigint in server responses
    return JSON.parse(
      JSON.stringify(quotes, (_, value) => (typeof value === "bigint" ? value.toString() : value)),
    );
  });
