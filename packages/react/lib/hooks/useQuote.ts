import {
  type ExactInSwapParams,
  getQuote,
  type QuoteSelectionStrategy,
  type SuccessfulSimulatedQuote,
  type SwapParams,
  type TargetOutSwapParams,
} from "@spandex/core";
import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
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

export type UseQuoteParams<TSelectData = SuccessfulSimulatedQuote | null> = {
  swap: UseSwapParams;
  strategy: QuoteSelectionStrategy;
  query?: Omit<
    UseQueryOptions<SuccessfulSimulatedQuote | null, Error, TSelectData>,
    "queryKey" | "queryFn"
  >;
};

export function useQuote<TSelectData = SuccessfulSimulatedQuote | null>(
  params: UseQuoteParams<TSelectData>,
): UseQueryResult<TSelectData, Error> {
  const config = useSpandexConfig();
  const connection = useConnection();

  const { query, swap, strategy } = params;

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
  } as UseQueryOptions<SuccessfulSimulatedQuote | null, Error, TSelectData>;

  const strategyKey = typeof strategy === "string" ? strategy : "custom";

  const requirements = {
    queryKey: [
      "spandex",
      "quote",
      strategyKey,
      fullParams?.mode,
      fullParams?.chainId,
      fullParams?.inputToken,
      fullParams?.outputToken,
      fullParams?.slippageBps,
      fullParams?.swapperAccount,
      fullParams?.mode === "exactIn"
        ? fullParams?.inputAmount.toString()
        : fullParams?.outputAmount.toString(),
    ],
    queryFn: async () => {
      return getQuote({
        config,
        swap: fullParams as SwapParams,
        strategy,
      });
    },
    retry: 0,
    enabled: !!finalChainId && !!finalSwapperAccount && (query?.enabled ?? true),
  } as UseQueryOptions<SuccessfulSimulatedQuote | null, Error, TSelectData>;

  return useQuery({
    ...defaults,
    ...query,
    ...requirements,
  });
}
