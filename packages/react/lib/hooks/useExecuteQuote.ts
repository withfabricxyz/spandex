import {
  type BuiltCall,
  buildCalls,
  type ExactInSwapParams,
  type SuccessfulSimulatedQuote,
  type TargetOutSwapParams,
} from "@spandex/core";
import {
  type MutateOptions,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { type Hash, type PublicClient, publicActions, type WalletClient } from "viem";
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
type ExecutionMode = "single" | "batched" | "stepped";
type ExecutionStepStatus = "pending" | "active" | "complete";

export type ExecuteQuoteVariables = {
  allowanceMode?: AllowanceMode;
};

export type ExecuteQuoteStep = {
  index: number;
  type: BuiltCall["type"];
  label: string;
  status: ExecutionStepStatus;
  hash?: Hash;
};

export type ExecuteQuoteData = {
  transactionHash: Hash;
  mode: ExecutionMode;
  stepIndex: number;
  totalSteps: number;
  action: string;
  completed: boolean;
};

type PreparedExecutionPlan = {
  mode: ExecutionMode;
  calls: BuiltCall[];
};

type StepProgress = {
  completedCount: number;
  hashes: Record<number, Hash>;
};

export type UseExecuteQuoteParams<TOnMutateResult = unknown> = {
  swap: UseSwapParams;
  quote: SuccessfulSimulatedQuote;
  allowanceMode?: AllowanceMode;
  mutation?: Omit<
    UseMutationOptions<ExecuteQuoteData, Error, ExecuteQuoteVariables | undefined, TOnMutateResult>,
    "mutationFn"
  >;
  preparation?: Omit<UseQueryOptions<PreparedExecutionPlan, Error>, "queryKey" | "queryFn">;
};

export type UseExecuteQuoteResult<TOnMutateResult = unknown> = UseMutationResult<
  ExecuteQuoteData,
  Error,
  ExecuteQuoteVariables | undefined,
  TOnMutateResult
> & {
  mode: ExecutionMode | null;
  calls: BuiltCall[];
  steps: ExecuteQuoteStep[];
  totalSteps: number;
  currentStepIndex: number | null;
  currentActionLabel: string | null;
  currentStepText: string | null;
  canAutoExecute: boolean;
  isPreparing: boolean;
  isReady: boolean;
  preparationError: Error | null;
  executeQuote: (
    variables?: ExecuteQuoteVariables,
    options?: MutateOptions<
      ExecuteQuoteData,
      Error,
      ExecuteQuoteVariables | undefined,
      TOnMutateResult
    >,
  ) => void;
  executeQuoteAsync: (
    variables?: ExecuteQuoteVariables,
    options?: MutateOptions<
      ExecuteQuoteData,
      Error,
      ExecuteQuoteVariables | undefined,
      TOnMutateResult
    >,
  ) => Promise<ExecuteQuoteData>;
};

export function useExecuteQuote<TOnMutateResult = unknown>({
  swap,
  quote,
  allowanceMode,
  mutation,
  preparation,
}: UseExecuteQuoteParams<TOnMutateResult>): UseExecuteQuoteResult<TOnMutateResult> {
  const config = useSpandexConfig();
  const wagmiConfig = useConfig();
  const connection = useConnection();
  const { data: walletClient } = useWalletClient();
  const [progress, setProgress] = useState<StepProgress>({ completedCount: 0, hashes: {} });

  const resolvedSwapResult = useMemo(() => {
    try {
      return {
        swap: resolveSwapParams({
          swap,
          chainId: connection.chain?.id,
          swapperAccount: connection.address,
        }),
      };
    } catch (error) {
      return { error: error as Error };
    }
  }, [swap, connection.chain?.id, connection.address]);

  const publicClient = useMemo(() => {
    const resolvedSwap = resolvedSwapResult.swap;
    if (!resolvedSwap) return undefined;

    return wagmiConfig.getClient({ chainId: resolvedSwap.chainId })?.extend(publicActions) as
      | PublicClient
      | undefined;
  }, [wagmiConfig, resolvedSwapResult.swap]);

  const progressKey = useMemo(() => {
    const resolvedSwap = resolvedSwapResult.swap;
    return JSON.stringify({
      chainId: resolvedSwap?.chainId ?? null,
      swapperAccount: resolvedSwap?.swapperAccount ?? null,
      inputToken: resolvedSwap?.inputToken ?? null,
      outputToken: resolvedSwap?.outputToken ?? null,
      mode: resolvedSwap?.mode ?? null,
      inputAmount: resolvedSwap?.mode === "exactIn" ? resolvedSwap.inputAmount.toString() : null,
      outputAmount:
        resolvedSwap?.mode === "targetOut" ? resolvedSwap.outputAmount.toString() : null,
      allowanceMode: allowanceMode ?? "exact",
      provider: quote.provider,
      quoteTo: quote.txData.to,
      quoteData: quote.txData.data,
    });
  }, [resolvedSwapResult.swap, allowanceMode, quote]);

  const preparedPlan = useQuery<PreparedExecutionPlan, Error>({
    queryKey: ["spandex", "executeQuote", "plan", progressKey],
    queryFn: async () => {
      const resolvedSwap = resolvedSwapResult.swap;
      if (!resolvedSwap) {
        throw resolvedSwapResult.error ?? new Error("Unable to resolve swap for execution.");
      }

      if (!walletClient) {
        throw new Error("No WalletClient available from wagmi. Connect a wallet before executing.");
      }

      return buildPreparedExecutionPlan({
        config,
        quote,
        swap: resolvedSwap,
        walletClient: walletClient as WalletClient,
        publicClient,
        allowanceMode: allowanceMode ?? "exact",
      });
    },
    enabled: Boolean(resolvedSwapResult.swap && walletClient),
    retry: 0,
    ...preparation,
  });

  const result = useMutation<
    ExecuteQuoteData,
    Error,
    ExecuteQuoteVariables | undefined,
    TOnMutateResult
  >({
    ...mutation,
    mutationKey: ["spandex", "executeQuote", "mutation", progressKey],
    mutationFn: async (variables) => {
      const resolvedSwap = resolvedSwapResult.swap;
      if (!resolvedSwap) {
        throw resolvedSwapResult.error ?? new Error("Unable to resolve swap for execution.");
      }

      if (!walletClient) {
        throw new Error("No WalletClient available from wagmi. Connect a wallet before executing.");
      }

      assertWalletChain({
        walletClient: walletClient as WalletClient,
        chainId: resolvedSwap.chainId,
      });

      const plan =
        preparedPlan.data ??
        (await buildPreparedExecutionPlan({
          config,
          quote,
          swap: resolvedSwap,
          walletClient: walletClient as WalletClient,
          publicClient,
          allowanceMode: variables?.allowanceMode ?? allowanceMode ?? "exact",
        }));

      if (plan.mode === "batched") {
        const transactionHash = await executeBatched({
          calls: plan.calls,
          swap: resolvedSwap,
          walletClient: walletClient as WalletClient,
        });

        return {
          transactionHash,
          mode: "batched",
          stepIndex: plan.calls.length,
          totalSteps: plan.calls.length,
          action: joinActionLabels(plan.calls),
          completed: true,
        };
      }

      const stepIndex = plan.mode === "single" ? 1 : progress.completedCount + 1;
      const call = plan.calls[stepIndex - 1];
      if (!call) {
        throw new Error("All execution steps are already complete.");
      }

      const transactionHash = await executeSingleCall({
        call,
        swap: resolvedSwap,
        walletClient: walletClient as WalletClient,
      });

      return {
        transactionHash,
        mode: plan.mode,
        stepIndex,
        totalSteps: plan.calls.length,
        action: labelForCall(call),
        completed: stepIndex >= plan.calls.length,
      };
    },
    onSuccess: async (data, variables, context, mutationContext) => {
      setProgress((current) => {
        if (data.mode === "batched") {
          return { completedCount: data.totalSteps, hashes: current.hashes };
        }

        return {
          completedCount: Math.max(current.completedCount, data.stepIndex),
          hashes: {
            ...current.hashes,
            [data.stepIndex]: data.transactionHash,
          },
        };
      });

      await mutation?.onSuccess?.(data, variables, context, mutationContext);
    },
    onError: async (error, variables, context, mutationContext) => {
      await mutation?.onError?.(error, variables, context, mutationContext);
    },
  });

  useEffect(() => {
    void progressKey;
    setProgress({ completedCount: 0, hashes: {} });
    result.reset();
  }, [progressKey, result.reset]);

  const activePlan = preparedPlan.data;
  const totalSteps = activePlan?.calls.length ?? 0;
  const currentStepIndex =
    activePlan && progress.completedCount < totalSteps ? progress.completedCount + 1 : null;
  const currentCall = currentStepIndex ? activePlan?.calls[currentStepIndex - 1] : null;

  const steps: ExecuteQuoteStep[] = (activePlan?.calls ?? []).map((call, index) => {
    const stepIndex = index + 1;
    const status: ExecutionStepStatus =
      stepIndex <= progress.completedCount
        ? "complete"
        : stepIndex === progress.completedCount + 1
          ? "active"
          : "pending";

    return {
      index: stepIndex,
      type: call.type,
      label: labelForCall(call),
      status,
      hash: progress.hashes[stepIndex],
    };
  });

  const currentActionLabel = activePlan
    ? activePlan.mode === "batched"
      ? joinActionLabels(activePlan.calls)
      : currentCall
        ? labelForCall(currentCall)
        : null
    : null;

  const currentStepText =
    activePlan?.mode === "stepped" && currentStepIndex
      ? `Step ${currentStepIndex} of ${totalSteps}`
      : null;

  return {
    ...result,
    mode: activePlan?.mode ?? null,
    calls: activePlan?.calls ?? [],
    steps,
    totalSteps,
    currentStepIndex,
    currentActionLabel,
    currentStepText,
    canAutoExecute: activePlan ? activePlan.mode !== "stepped" : false,
    isPreparing: preparedPlan.isLoading || preparedPlan.isFetching,
    isReady: Boolean(activePlan),
    preparationError: resolvedSwapResult.error ?? preparedPlan.error ?? null,
    executeQuote: (variables, options) => result.mutate(variables, options),
    executeQuoteAsync: (variables, options) => result.mutateAsync(variables, options),
  };
}

async function buildPreparedExecutionPlan({
  config,
  quote,
  swap,
  walletClient,
  publicClient,
  allowanceMode,
}: {
  config: ReturnType<typeof useSpandexConfig>;
  quote: SuccessfulSimulatedQuote;
  swap: ExactInSwapParams | TargetOutSwapParams;
  walletClient: WalletClient;
  publicClient?: PublicClient;
  allowanceMode: AllowanceMode;
}): Promise<PreparedExecutionPlan> {
  const calls = await buildCalls({
    config,
    quote,
    swap,
    publicClient,
    allowanceMode,
  });

  const canBatch = await isBatchSupported(walletClient);
  return {
    mode: resolveExecutionMode({ calls, canBatch }),
    calls,
  };
}

function resolveExecutionMode({
  calls,
  canBatch,
}: {
  calls: BuiltCall[];
  canBatch: boolean;
}): ExecutionMode {
  if (calls.length === 1) {
    return "single";
  }

  if (canBatch) {
    return "batched";
  }

  return "stepped";
}

async function isBatchSupported(client: WalletClient): Promise<boolean> {
  try {
    const capabilities = await client.getCapabilities({ chainId: client.chain?.id || 0 });
    return capabilities.atomic?.status === "supported";
  } catch {
    return false;
  }
}

async function executeBatched({
  calls,
  swap,
  walletClient,
}: {
  calls: BuiltCall[];
  swap: ExactInSwapParams | TargetOutSwapParams;
  walletClient: WalletClient;
}): Promise<Hash> {
  const { receipts, status } = await walletClient.sendCallsSync({
    chain: walletClient.chain,
    account: swap.swapperAccount,
    calls: calls.map((call) => call.txn),
    throwOnFailure: true,
  });

  const receipt = receipts?.[receipts.length - 1];
  if (!receipt || status !== "success") {
    throw new Error("Atomic transaction execution failed.");
  }

  return receipt.transactionHash;
}

async function executeSingleCall({
  call,
  swap,
  walletClient,
}: {
  call: BuiltCall;
  swap: ExactInSwapParams | TargetOutSwapParams;
  walletClient: WalletClient;
}): Promise<Hash> {
  const receipt = await walletClient.sendTransactionSync({
    chain: walletClient.chain,
    account: swap.swapperAccount,
    ...call.txn,
    throwOnReceiptRevert: true,
  });

  return receipt.transactionHash;
}

function assertWalletChain({
  walletClient,
  chainId,
}: {
  walletClient: WalletClient;
  chainId: number;
}) {
  if (walletClient.chain?.id !== chainId) {
    throw new Error(
      `Client chain ID ${walletClient.chain?.id} does not match swap chain ID ${chainId}`,
    );
  }
}

function labelForCall(call: BuiltCall): string {
  return call.type === "approval" ? "Approve" : "Swap";
}

function joinActionLabels(calls: BuiltCall[]): string {
  return calls.map(labelForCall).join(" & ");
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
