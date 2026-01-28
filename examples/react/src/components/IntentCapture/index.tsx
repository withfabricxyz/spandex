import type { SimulatedQuote } from "@spandex/core";
import { useQuotes } from "@spandex/react";
import { useCallback, useMemo, useState } from "react";
import { type Address, encodeFunctionData, erc20Abi, type Hex, maxUint256 } from "viem";
import { useConnection } from "wagmi";
import { getExplorerLink } from "@/config/onchain";
import { useAllowance } from "@/hooks/useAllowance";
import { useBalance } from "@/hooks/useBalance";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import {
  type StructuredError,
  type SwapErrorState,
  structureError,
  validateSwapInput,
} from "@/utils/errors";
import {
  getBestQuoteByMetric,
  getSimulationFailureReason,
  type Metric,
} from "@/utils/quoteHelpers";
import { parseTokenValue } from "@/utils/strings";
import { toast } from "../Toast";
import { Insights } from "./Insights";
import { SuccessSplash } from "./SuccessSplash";
import { SwapControls } from "./SwapControls";
import { TxBatchButton } from "./TxBatchButton";

export type TxData = {
  name: string;
  data: Hex;
  to: Address;
  value?: bigint;
  chainId: number;
};

function prepareCalls({
  chainId,
  bestQuote,
  needsApproval,
  sellTokenAddress,
}: {
  chainId?: number;
  bestQuote?: SimulatedQuote;
  needsApproval: boolean;
  sellTokenAddress: Address;
}): TxData[] {
  if (!chainId || !bestQuote?.success) return [];

  const calls: TxData[] = [];

  if (bestQuote.txData.data) {
    const spender = bestQuote.txData.to;

    if (needsApproval) {
      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, maxUint256],
      });

      calls.push({
        to: sellTokenAddress,
        name: "APPROVE",
        data: approvalData,
        chainId,
        value: 0n,
      });
    }

    calls.push({
      to: bestQuote.txData.to,
      name: "SELL",
      data: bestQuote.txData.data,
      chainId,
      value: BigInt(bestQuote.txData.value || 0),
    });
  }

  return calls;
}

export function IntentCapture() {
  const { sellToken, setSellToken, buyToken, setBuyToken } = useTokenSelect();
  const { address, chainId, isConnected } = useConnection();
  const [prevSellToken, setPrevSellToken] = useState(sellToken);
  const [numSellTokens, setNumSellTokens] = useState<string>(sellToken.defaultInput);
  const [selectedMetric, setSelectedMetric] = useState<Metric>("price");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [txError, setTxError] = useState<StructuredError | null>(null);
  const [successfulTx, setSuccessfulTx] = useState<{
    hash: `0x${string}`;
    chainId: number;
    inputAmount: bigint;
    outputAmount: bigint;
  } | null>(null);

  if (sellToken !== prevSellToken) {
    setPrevSellToken(sellToken);
    setNumSellTokens(sellToken.defaultInput);
  }

  const { data: sellTokenBalance, isLoading: isLoadingBalance } = useBalance({
    chainId,
    owner: address,
    token: sellToken.address,
  });

  const { data: buyTokenBalance } = useBalance({
    chainId,
    owner: address,
    token: buyToken.address,
  });

  const balances = {
    sellToken: sellTokenBalance,
    buyToken: buyTokenBalance,
  };

  const swap = useMemo(
    () => ({
      // allow quotes to be fetched without connected wallet
      chainId: chainId || 8453,
      swapperAccount: address || sellToken.whaleAddress,

      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps,
      mode: "exactIn" as const,
      inputAmount: parseTokenValue(numSellTokens, sellToken.decimals),
    }),
    [sellToken, buyToken, numSellTokens, chainId, slippageBps, address],
  );

  const query = useMemo(
    () => ({
      refetchInterval: 10000, // refetch to build quote history
      enabled: swap.inputAmount > 0n,
    }),
    [swap.inputAmount],
  );

  const {
    data: quotes,
    isLoading: isLoadingQuotes,
    error: quotesError,
  } = useQuotes({
    swap,
    query,
  });

  // TODO: useBestQuote?
  const bestQuote = getBestQuoteByMetric({
    quotes,
    metric: selectedMetric,
  });

  const {
    data: allowance,
    // isLoading: allowanceLoading,
    // error: allowanceError,
  } = useAllowance({
    chainId,
    owner: address,
    token: sellToken.address,
    spender: bestQuote?.success ? bestQuote.txData.to : undefined,
  });

  const needsApproval = useMemo(() => {
    if (!bestQuote?.success) return false;

    const inputAmount = BigInt(bestQuote.inputAmount || 0);
    const currentAllowance = allowance || 0n;

    return inputAmount > 0n && currentAllowance < inputAmount;
  }, [bestQuote, allowance]);

  // derive all swap errors
  const errors: SwapErrorState = useMemo(() => {
    const state: SwapErrorState = {};

    if (!isConnected) {
      state.connection = {
        title: "Connect wallet to swap",
        cause: "disconnected",
      };
    }

    const inputError = validateSwapInput(numSellTokens, sellTokenBalance, sellToken.decimals);

    if (inputError) {
      state.input = inputError;
    }

    if (quotesError) {
      state.quote = {
        title: "Failed to fetch quotes",
        description: "There was an error fetching quotes for this swap",
        details: quotesError.message,
        cause: quotesError,
      };
    }

    // TODO: spandex selectQuote
    // quotes failed
    if (quotes?.length && !bestQuote) {
      state.quote = {
        title: "No valid quotes available",
        description: "All aggregators failed to return a quote",
        cause: quotes,
      };
    }

    // we have our best quote, but that quote's simulation failed
    if (bestQuote?.success && !bestQuote.simulation.success) {
      const reason = getSimulationFailureReason(bestQuote, allowance);
      state.simulation = {
        title: reason || "Simulation failed",
        description: "This swap will likely fail if executed",
        details: bestQuote.simulation.error?.message,
        cause: bestQuote.simulation,
      };
    }

    // set by tx button callback
    if (txError) {
      state.transaction = txError;
    }

    return state;
  }, [
    isConnected,
    numSellTokens,
    sellTokenBalance,
    sellToken.decimals,
    quotes,
    quotesError,
    bestQuote,
    allowance,
    txError,
  ]);

  // TODO: handle no wallet connected state
  const hasBlockingError = Boolean(errors.input || errors.quote || errors.simulation);

  const calls = useMemo(
    () =>
      prepareCalls({
        chainId,
        bestQuote,
        needsApproval,
        sellTokenAddress: sellToken.address,
      }),
    [bestQuote, needsApproval, chainId, sellToken.address],
  );

  const onSwitchTokens = useCallback(() => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
  }, [buyToken, sellToken, setSellToken, setBuyToken]);

  const onTxError = useCallback((error: unknown) => {
    setTxError(structureError(error));
  }, []);

  const onComplete = useCallback(
    (hash: `0x${string}`) => {
      if (!chainId || !bestQuote?.success) return;

      toast("Transaction Success", {
        link: getExplorerLink(chainId, "tx", hash),
      });

      setSuccessfulTx({
        hash,
        chainId,
        inputAmount: swap.inputAmount,
        outputAmount: bestQuote.outputAmount || 0n,
      });
    },
    [chainId, bestQuote, swap.inputAmount],
  );

  return (
    <div className="flex flex-col gap-20">
      <SwapControls
        bestQuote={bestQuote}
        sellToken={sellToken}
        balances={balances}
        isLoadingBalances={isLoadingBalance}
        numSellTokens={numSellTokens}
        setNumSellTokens={setNumSellTokens}
        buyToken={buyToken}
        isLoadingQuotes={isLoadingQuotes}
        onSwitchTokens={onSwitchTokens}
        errors={errors}
      />
      <hr className="border-primary" />
      <Insights
        bestQuote={bestQuote}
        quotes={quotes}
        sellToken={sellToken}
        buyToken={buyToken}
        numSellTokens={numSellTokens}
        selectedMetric={selectedMetric}
        setSelectedMetric={setSelectedMetric}
        slippageBps={slippageBps}
        setSlippageBps={setSlippageBps}
        errors={errors}
      />
      <hr className="border-primary" />
      <TxBatchButton
        blocked={calls.length === 0 || hasBlockingError}
        calls={calls}
        onComplete={onComplete}
        onError={onTxError}
        errors={errors}
      />
      {successfulTx && address ? (
        <SuccessSplash
          sellToken={sellToken}
          buyToken={buyToken}
          onClose={() => setSuccessfulTx(null)}
          successfulTx={successfulTx}
        />
      ) : null}
    </div>
  );
}
