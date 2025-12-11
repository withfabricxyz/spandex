import type { SimulatedQuote } from "@withfabric/spandex";
import { useQuotes } from "@withfabric/spandex-react";
import { useMemo } from "react";
import { type Address, encodeFunctionData, erc20Abi, type Hex, maxUint256 } from "viem";
import { useConnection } from "wagmi";
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

type DerivedMetrics = {
  inaccuracyBps: number | null;
  positiveSlippage: { percentage: number; diff: number; } | null;
  fees: bigint | null;
};

type PreparedSwap = {
  calls: TxData[];
};

type UseSwapResult = {
  quotes: SimulatedQuote[] | undefined;
  isLoading: boolean;
  error: unknown;
  inputBalance: bigint | undefined;
  outputBalance: bigint | undefined;
  allowance: bigint | undefined;
  derivedMetrics: DerivedMetrics | null;
  swap: PreparedSwap;
};

// TODO: does this hook have too many concerns? perhaps useSwapMetrics, usePreparedSwap.
// useBalance is also transient - probably shouldn't be here
export function useSwap({ chainId, address, sellToken, numSellTokens, buyToken }: UseSwapParams): UseSwapResult {
  const { chainId: connectionChainId } = useConnection();
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

  const swapParams = useMemo(() => {
    return {
      chainId: chainId || connectionChainId,
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps: 100,
      mode: "exactIn",
      inputAmount: Number(numSellTokens) * 10 ** sellToken.decimals,
    };
  }, [sellToken, buyToken, numSellTokens, chainId, connectionChainId]);

  const {
    data,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuotes({
    // TODO: swap type
    // @ts-expect-error
    swap: swapParams,
    query: {
      refetchInterval: 2500,
    },
  });

  // TODO: select best
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
    const calls: TxData[] = [];
    const inputAmount = BigInt(firstSuccess?.inputAmount || 0);

    if (firstSuccess?.txData.data) {
      const spender = firstSuccess.txData.to;
      const currentAllowance = BigInt(allowance || 0);

      if (inputAmount > 0n && currentAllowance < inputAmount) {
        const approvalData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, maxUint256],
        });

        calls.push({
          to: sellToken.address,
          name: "APPROVE",
          data: approvalData,
          chainId: swapParams.chainId as number,
          value: 0n,
        });
      }

      calls.push({
        to: firstSuccess.txData.to,
        name: "SELL",
        data: firstSuccess.txData.data,
        chainId: swapParams.chainId as number,
        value: BigInt(firstSuccess.txData.value || 0),
      });
    }

    const swap: PreparedSwap = { calls };

    const balancesLoading = inputBalanceLoading || outputBalanceLoading;
    const balancesError = inputBalanceError || outputBalanceError;
    const isLoading = quotesLoading || balancesLoading || allowanceLoading;
    const error = quotesError || balancesError || allowanceError; // TODO: real errors

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
      swap,
    };
  }, [
    data,
    firstSuccess,
    swapParams,
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
    sellToken.address,
  ]);
}
