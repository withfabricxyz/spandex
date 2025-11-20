import type { ExactInSwapParams, ExactOutSwapParams, SuccessfulQuote } from "@withfabric/smal";
import { useCallback, useMemo, useState } from "react";
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

export function useQuotes(params: UseQuotesParams) {
  const { metaAggregator } = useSmalConfig();
  const connection = useConnection();
  const [quotes, setQuotes] = useState<SuccessfulQuote[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

  const getQuotes = useCallback(async () => {
    if (!fullParams) return null;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedQuotes = await metaAggregator.fetchAllQuotes(fullParams);
      // TODO: return failed quotes? UI's may be concerned with failed quotes too
      const successfulQuotes = fetchedQuotes.filter((quote) => quote.success);

      setQuotes(successfulQuotes);

      return successfulQuotes;
    } catch (err) {
      setError(err as Error);
      setQuotes(null);

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [metaAggregator, fullParams]);

  return { quotes, isLoading, error, getQuotes };
}
