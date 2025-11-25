import { useQuery } from "@tanstack/react-query";
import type {
  ExactInSwapParams,
  ExactOutSwapParams,
  MetaAggregator,
  Quote,
} from "@withfabric/smal";
import { useMemo } from "react";
import { useConnection } from "wagmi";
import { useSmalConfig } from "../context/SmalProvider.js";

export type UseQuotesParams = (
  | Omit<ExactInSwapParams, "chainId" | "swapperAccount">
  | Omit<ExactOutSwapParams, "chainId" | "swapperAccount">
) & {
  chainId?: number;
  swapperAccount?: `0x${string}`;
  enabled?: boolean;
};

export type UseQuotesResult = {
  quotes: Quote[] | null;
  isLoading: boolean;
  error: unknown;
};

async function fetchQuotes(
  metaAggregator: MetaAggregator,
  params: ExactInSwapParams | ExactOutSwapParams,
): Promise<Quote[]> {
  const fetchedQuotes = await metaAggregator.fetchAllQuotes(params);
  return fetchedQuotes;
}

export function useQuotes(params: UseQuotesParams): UseQuotesResult {
  const { metaAggregator } = useSmalConfig();
  const connection = useConnection();

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

  const {
    data: quotes,
    isLoading,
    error,
  } = useQuery({
    queryKey: fullParams
      ? [
          "smal-quotes",
          fullParams.mode,
          fullParams.chainId,
          fullParams.inputToken,
          fullParams.outputToken,
          fullParams.slippageBps,
          fullParams.swapperAccount,
          fullParams.mode === "exactInQuote"
            ? fullParams.inputAmount.toString()
            : fullParams.outputAmount.toString(),
        ]
      : ["smal-quotes", null],
    queryFn: () => {
      if (!fullParams) throw new Error("Missing required parameters");
      return fetchQuotes(metaAggregator, fullParams);
    },
    enabled: params.enabled !== false && fullParams !== null,
    staleTime: 10_000,
    retry: 2,
  });

  return {
    quotes: quotes ?? null,
    isLoading,
    error,
  };
}
