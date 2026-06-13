import {
  executeQuote as coreExecuteQuote,
  type ExactInSwapParams,
  type SuccessfulSimulatedQuote,
  type TargetOutSwapParams,
} from "@spandex/core";
import {
  type UseMutateAsyncFunction,
  type UseMutateFunction,
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { type PublicClient, publicActions } from "viem";
import { useConfig, useConnection, useWalletClient } from "wagmi";
import { useSpandexConfig } from "../context/SpandexProvider.js";

type UseSwapParams = (
  | Omit<ExactInSwapParams, "chainId" | "swapperAccount">
  | Omit<TargetOutSwapParams, "chainId" | "swapperAccount">
) & {
  chainId?: number;
  swapperAccount?: `0x${string}`;
};

type AllowanceMode = "unlimited" | "exact";

export type ExecuteQuoteVariables = {
  swap: UseSwapParams;
  quote: SuccessfulSimulatedQuote;
  allowanceMode?: AllowanceMode;
};

type ExecuteQuoteData = Awaited<ReturnType<typeof coreExecuteQuote>>;

export type UseExecuteQuoteParams<TOnMutateResult = unknown> = {
  allowanceMode?: AllowanceMode;
  mutation?: Omit<
    UseMutationOptions<ExecuteQuoteData, Error, ExecuteQuoteVariables, TOnMutateResult>,
    "mutationFn"
  >;
};

export type UseExecuteQuoteResult<TOnMutateResult = unknown> = UseMutationResult<
  ExecuteQuoteData,
  Error,
  ExecuteQuoteVariables,
  TOnMutateResult
> & {
  executeQuote: UseMutateFunction<ExecuteQuoteData, Error, ExecuteQuoteVariables, TOnMutateResult>;
  executeQuoteAsync: UseMutateAsyncFunction<
    ExecuteQuoteData,
    Error,
    ExecuteQuoteVariables,
    TOnMutateResult
  >;
};

export function useExecuteQuote<TOnMutateResult = unknown>({
  allowanceMode,
  mutation,
}: UseExecuteQuoteParams<TOnMutateResult> = {}): UseExecuteQuoteResult<TOnMutateResult> {
  const config = useSpandexConfig();
  const wagmiConfig = useConfig();
  const connection = useConnection();
  const { data: walletClient } = useWalletClient();

  const result = useMutation<ExecuteQuoteData, Error, ExecuteQuoteVariables, TOnMutateResult>({
    mutationKey: ["spandex", "executeQuote"],
    ...mutation,
    mutationFn: async ({ swap, quote, allowanceMode: callAllowanceMode }) => {
      const resolvedSwap = resolveSwapParams({
        swap,
        chainId: connection.chain?.id,
        swapperAccount: connection.address,
      });

      if (!walletClient) {
        throw new Error("No WalletClient available from wagmi. Connect a wallet before executing.");
      }

      const publicClient = wagmiConfig
        .getClient({ chainId: resolvedSwap.chainId })
        ?.extend(publicActions) as PublicClient | undefined;

      return coreExecuteQuote({
        config,
        quote,
        swap: resolvedSwap,
        walletClient,
        publicClient,
        allowanceMode: callAllowanceMode ?? allowanceMode ?? "exact",
      });
    },
  });

  return {
    ...result,
    executeQuote: result.mutate,
    executeQuoteAsync: result.mutateAsync,
  };
}

function resolveSwapParams({
  swap,
  chainId,
  swapperAccount,
}: {
  swap: UseSwapParams;
  chainId?: number;
  swapperAccount?: `0x${string}`;
}): ExactInSwapParams | TargetOutSwapParams {
  const finalChainId = swap.chainId ?? chainId;
  if (!finalChainId) {
    throw new Error(
      "No chainId provided to useExecuteQuote. Pass swap.chainId or connect a wallet on the target chain.",
    );
  }

  const finalSwapperAccount = swap.swapperAccount ?? swapperAccount;
  if (!finalSwapperAccount) {
    throw new Error(
      "No swapperAccount provided to useExecuteQuote. Pass swap.swapperAccount or connect a wallet.",
    );
  }

  const baseParams = {
    chainId: finalChainId,
    outputChainId: swap.outputChainId,
    inputToken: swap.inputToken,
    outputToken: swap.outputToken,
    slippageBps: swap.slippageBps,
    swapperAccount: finalSwapperAccount,
    recipientAccount: swap.recipientAccount,
  };

  if (swap.mode === "exactIn") {
    return {
      ...baseParams,
      mode: "exactIn",
      inputAmount: swap.inputAmount,
    };
  }

  return {
    ...baseParams,
    mode: "targetOut",
    outputAmount: swap.outputAmount,
  };
}
