import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type {
  ExactInSwapParams,
  MetaAggregator,
  Quote,
  SwapParams,
  TargetOutSwapParams,
} from "@withfabric/smal";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useSmalConfig } from "../context/SmalProvider.js";

export type UseQuotesParams<TSelectData = Quote[]> = (
  | Omit<ExactInSwapParams, "chainId" | "swapperAccount">
  | Omit<TargetOutSwapParams, "chainId" | "swapperAccount">
) & {
  chainId?: number;
  swapperAccount?: `0x${string}`;
  query?: Omit<UseQueryOptions<Quote[], Error, TSelectData>, "queryKey" | "queryFn">;
};

async function fetchQuotes(
  metaAggregator: MetaAggregator,
  params: ExactInSwapParams | TargetOutSwapParams,
): Promise<Quote[]> {
  const fetchedQuotes = await metaAggregator.fetchQuotes(params);
  return fetchedQuotes;
}

export function useQuotes<TSelectData = Quote[]>(
  params: UseQuotesParams<TSelectData>,
): UseQueryResult<TSelectData, Error> {
  const { metaAggregator } = useSmalConfig();
  const connection = useConnection();

  const { query } = params;

  const finalChainId = params.chainId ?? connection.chain?.id;
  const finalSwapperAccount = params.swapperAccount ?? connection.address;

  const fullParams = useMemo(() => {
    if (!finalChainId || !finalSwapperAccount) {
      return null;
    }

    const baseParams = {
      chainId: finalChainId,
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      slippageBps: params.slippageBps,
      swapperAccount: finalSwapperAccount,
    };

    if (params.mode === "exactIn") {
      return {
        ...baseParams,
        mode: "exactIn" as const,
        inputAmount: params.inputAmount,
      };
    }

    return {
      ...baseParams,
      mode: "targetOut" as const,
      outputAmount: params.outputAmount,
    };
  }, [finalChainId, finalSwapperAccount, params]);

  const defaults = {
    staleTime: 10_000,
  } as UseQueryOptions<Quote[], Error, TSelectData>;

  const requirements = {
    queryKey: [
      "smal",
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
    queryFn: () => {
      return fetchQuotes(metaAggregator, fullParams as SwapParams);
    },
    retry: 0,
    enabled: !!finalChainId && !!finalSwapperAccount && (query?.enabled ?? true),
  } as UseQueryOptions<Quote[], Error, TSelectData>;

  return useQuery({
    ...defaults,
    ...query,
    ...requirements,
  });
}
