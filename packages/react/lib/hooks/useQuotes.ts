import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import {
  deserializeWithBigInt,
  type ExactInSwapParams,
  getQuotes,
  type Quote,
  type SimulatedQuote,
  type SwapParams,
  serializeWithBigInt,
  type TargetOutSwapParams,
} from "@withfabric/spandex";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useSpandexConfig } from "../context/SpandexProvider.js";
import { bigintReplacer, bigintReviver } from "../util/index.js";

type UseSwapParams = (
  | Omit<ExactInSwapParams, "chainId" | "swapperAccount">
  | Omit<TargetOutSwapParams, "chainId" | "swapperAccount">
) & {
  chainId?: number;
  swapperAccount?: `0x${string}`;
};

export type UseQuotesParams<TSelectData = Quote[]> = {
  swap: UseSwapParams;
  query?: Omit<UseQueryOptions<SimulatedQuote[], Error, TSelectData>, "queryKey" | "queryFn">;
  serverAction?: true | string;
};

export function useQuotes<TSelectData = SimulatedQuote[]>(
  params: UseQuotesParams<TSelectData>,
): UseQueryResult<TSelectData, Error> {
  const config = useSpandexConfig();
  const connection = useConnection();

  const { query, swap } = params;

  const finalChainId = swap.chainId ?? connection.chain?.id;
  const finalSwapperAccount = swap.swapperAccount ?? connection.address;

  const fullParams = useMemo(() => {
    if (!finalChainId || !finalSwapperAccount) {
      return null;
    }

    const baseParams = {
      chainId: finalChainId,
      inputToken: swap.inputToken,
      outputToken: swap.outputToken,
      slippageBps: swap.slippageBps,
      swapperAccount: finalSwapperAccount,
    };

    if (swap.mode === "exactIn") {
      return {
        ...baseParams,
        mode: "exactIn" as const,
        inputAmount: swap.inputAmount,
      };
    }

    return {
      ...baseParams,
      mode: "targetOut" as const,
      outputAmount: swap.outputAmount,
    };
  }, [finalChainId, finalSwapperAccount, swap]);

  const defaults = {
    staleTime: 10_000,
  } as UseQueryOptions<SimulatedQuote[], Error, TSelectData>;

  const requirements = {
    queryKey: [
      "spandex",
      fullParams?.mode,
      fullParams?.chainId,
      fullParams?.inputToken,
      fullParams?.outputToken,
      fullParams?.slippageBps,
      fullParams?.swapperAccount,
      fullParams?.mode === "exactIn"
        ? fullParams?.inputAmount.toString()
        : fullParams?.outputAmount.toString(),
      params.serverAction,
    ],
    queryFn: async () => {
      if (params.serverAction === undefined) {
        return getQuotes({ config, swap: fullParams as SwapParams });
      } else if (params.serverAction === true) {
        const { getServerQuotes } = await import("../functions/getServerQuotes.js");
        const quotesString = await getServerQuotes({ swap: fullParams as SwapParams });
        return deserializeWithBigInt(quotesString);
      } else {
        return fetch(params.serverAction, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: serializeWithBigInt({ swap: fullParams }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`Network response was not ok: ${res.statusText}`);
            }
            return res.text();
          })
          .then((text) => deserializeWithBigInt(text));
      }
    },
    retry: 0,
    enabled: !!finalChainId && !!finalSwapperAccount && (query?.enabled ?? true),
  } as UseQueryOptions<SimulatedQuote[], Error, TSelectData>;

  return useQuery({
    ...defaults,
    ...query,
    ...requirements,
  });
}
