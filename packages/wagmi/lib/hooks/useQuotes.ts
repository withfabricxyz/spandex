import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type {
  ExactInSwapParams,
  ExactOutSwapParams,
  MetaAggregator,
  Quote,
  SwapParams,
} from "@withfabric/smal";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useSmalConfig } from "../context/SmalProvider.js";

export type UseQuotesParams<TSelectData = Quote[]> = (
  | Omit<ExactInSwapParams, "chainId" | "swapperAccount">
  | Omit<ExactOutSwapParams, "chainId" | "swapperAccount">
) & {
  chainId?: number;
  swapperAccount?: `0x${string}`;
  query?: Omit<UseQueryOptions<Quote[], Error, TSelectData>, "queryKey" | "queryFn">;
};

async function fetchQuotes(
  metaAggregator: MetaAggregator,
  params: ExactInSwapParams | ExactOutSwapParams,
): Promise<Quote[]> {
  const fetchedQuotes = await metaAggregator.fetchAllQuotes(params);
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

    if (params.mode === "exactInQuote") {
      return {
        ...baseParams,
        mode: "exactInQuote" as const,
        inputAmount: params.inputAmount,
      };
    }

    return {
      ...baseParams,
      mode: "exactOutputQuote" as const,
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
      fullParams?.mode === "exactInQuote"
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
