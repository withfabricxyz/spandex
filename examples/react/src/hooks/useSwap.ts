import { useQuotes } from "@withfabric/spandex-react";
import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useBalance } from "@/hooks/useBalance";
import type { TokenMetadata } from "@/services/tokens";
import { extractFees, getQuoteInaccuracy, getQuotePositiveSlippage } from "@/utils/quoteHelpers";
import { useAllowance } from "./useAllowance";

export type TxData = {
  name: string;
  data: Hex;
  to: Address;
  value?: bigint;
  chainId: number;
  afterSubmit?: () => Promise<void>; // Optional callback after submission
};

type UseSwapParams = {
  chainId?: number;
  address?: Address;
  sellToken: TokenMetadata;
  numSellTokens: string;
  buyToken: TokenMetadata;
};

export function useSwap({ chainId, address, sellToken, numSellTokens, buyToken }: UseSwapParams) {
  const {
    data: inputBalance,
    isLoading: inputBalanceLoading,
    error: inputBalanceError,
  } = useBalance({
    chainId: chainId,
    owner: address,
    token: sellToken.address,
  });
  const {
    data: outputBalance,
    isLoading: outputBalanceLoading,
    error: outputBalanceError,
  } = useBalance({
    chainId: chainId,
    owner: address,
    token: buyToken.address,
  });

  const swap = useMemo(() => {
    return {
      chainId: 8453,
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps: 100,
      mode: "exactIn",
      inputAmount: Number(numSellTokens) * 10 ** sellToken.decimals,
    };
  }, [sellToken, buyToken, numSellTokens]);

  const {
    data,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuotes({
    // TODO: swap type
    // @ts-expect-error
    swap,
    query: {
      refetchInterval: 2500,
    },
  });

  const firstSuccess = data?.find((quote) => quote.success);

  const {
    data: allowance,
    isLoading: allowanceLoading,
    error: allowanceError,
  } = useAllowance({
    chainId: chainId,
    owner: address,
    token: sellToken.address,
    spender: firstSuccess?.txData.to,
  });

  return useMemo(() => {
    // const contractAddress = firstSuccess?.txData.to;
    // const calls: TxData[] = [];
    // const inputAmount = BigInt(firstSuccess?.inputAmount || 0);
    // const outputAmount = BigInt(firstSuccess?.outputAmount || 0);

    // // Limit Orders Are Exact Swaps
    // if (firstSuccess?.txData.data) {
    //   calls.push({
    //     to: firstSuccess.txData.to,
    //     name: "SELL",
    //     data: firstSuccess.txData.data,
    //     chainId: swap.chainId as number,
    //     // @ts-expect-error
    //     value: BigInt(firstSuccess.txData.value),
    //   });
    // }

    const balancesLoading = inputBalanceLoading || outputBalanceLoading;
    const balancesError = inputBalanceError || outputBalanceError;
    const isLoading = quotesLoading || balancesLoading || allowanceLoading;
    const error = quotesError || balancesError || allowanceError; // TODO: real errors

    // Derive quote metrics
    const bestQuote = data?.[0];
    const derivedMetrics = bestQuote
      ? {
          inaccuracyBps: getQuoteInaccuracy(bestQuote),
          positiveSlippage: getQuotePositiveSlippage(bestQuote),
          fees: extractFees(bestQuote),
        }
      : null;

    return {
      quotes: data,
      isLoading,
      error,
      inputBalance,
      outputBalance,
      allowance,
      derivedMetrics,
    };
  }, [
    data,
    quotesLoading,
    inputBalance,
    inputBalanceLoading,
    inputBalanceError,
    outputBalance,
    outputBalanceLoading,
    outputBalanceError,
    allowance,
    allowanceLoading,
    allowanceError,
    quotesError,
  ]);
}
