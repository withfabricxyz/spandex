import {
  type ExactInSwapParams,
  getQuotes,
  prepareSimulatedQuotes,
  type Quote,
  type SimulatedQuote,
  type SwapParams,
  type TargetOutSwapParams,
} from "@spandex/core";
import {
  experimental_streamedQuery as streamedQuery,
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useSpandexConfig } from "../context/SpandexProvider.js";

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
  streamResults?: boolean;
};

export function useQuotes<TSelectData = SimulatedQuote[]>(
  params: UseQuotesParams<TSelectData>,
): UseQueryResult<TSelectData, Error> {
  const config = useSpandexConfig();
  const connection = useConnection();

  const { query, swap, streamResults = true } = params;

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
      recipientAccount: swap.recipientAccount,
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
      fullParams?.recipientAccount,
      fullParams?.mode === "exactIn"
        ? fullParams?.inputAmount.toString()
        : fullParams?.outputAmount.toString(),
    ],
    queryFn: streamResults
      ? streamedQuery({
          streamFn: async () => {
            const promises = await prepareSimulatedQuotes({
              config,
              swap: fullParams as SwapParams,
            });
            return toRacingIterable(promises);
          },
        })
      : async () => {
          return getQuotes({ config, swap: fullParams as SwapParams });
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

// Covert array of promises into an async iterable that yields results as they resolve to align with tanstack's streamedQuery
async function* toRacingIterable<T>(promises: Promise<T>[]): AsyncIterable<T> {
  const pending = new Set(promises.map((p) => Promise.resolve(p)));

  while (pending.size > 0) {
    let result: Awaited<T> | undefined;
    const racePromise = new Promise((resolve) => {
      for (const promise of pending) {
        promise
          .then((value) => {
            result = value;
            resolve(value);
          })
          .catch((error) => {
            throw error;
          })
          .finally(() => {
            pending.delete(promise);
          });
      }
    });

    await racePromise;
    if (result !== undefined) {
      yield result;
    }
  }
}
