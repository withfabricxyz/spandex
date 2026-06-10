import {
  buildCalls,
  type SimulationFailure,
  type SuccessfulQuote,
  type SuccessfulSimulatedQuote,
  type SwapParams,
} from "@spandex/core";
import { useQuotes, useSpandexConfig } from "@spandex/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { useConnection } from "wagmi";
import { getExplorerLink } from "@/config/onchain";
import { useAllowance } from "@/hooks/useAllowance";
import { useBalance } from "@/hooks/useBalance";
import { useSupportedChain } from "@/hooks/useSupportedChain";
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
  gas?: bigint;
};

// a quote that returned successfully but whose simulation reverted; narrowing
// FailedSimulatedQuote (an intersection containing the Quote union) through
// `success` checks is unreliable across TS versions, so name the shape directly
type FailedSimulationQuote = SuccessfulQuote & { simulation: SimulationFailure };

const QUOTE_REFRESH_INTERVAL_MS = 10_000;

export function IntentCapture() {
  const { sellToken, setSellToken, buyToken, setBuyToken, onSuccessfulTx } = useTokenSelect();
  const { address, chainId, isConnected } = useConnection();
  const { isSupportedChain } = useSupportedChain();
  const spandexConfig = useSpandexConfig();
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

  const { data: sellTokenBalance, isLoading: isLoadingSellBalance } = useBalance({
    chainId: sellToken.chainId,
    owner: address,
    token: sellToken.address,
    enabled: isSupportedChain,
  });

  const { data: buyTokenBalance, isLoading: isLoadingBuyBalance } = useBalance({
    chainId: buyToken.chainId,
    owner: address,
    token: buyToken.address,
    enabled: isSupportedChain,
  });

  const isLoadingBalances = isLoadingSellBalance || isLoadingBuyBalance;

  const balances = {
    // manually set to undefined here, or stale cached balances will appear after switching to an unsupported chain
    sellToken: isSupportedChain ? sellTokenBalance : undefined,
    buyToken: isSupportedChain ? buyTokenBalance : undefined,
  };

  const swap = useMemo(
    () => ({
      // always use the sell token's chain for quotes, even if disconnected or on wrong chain
      // we block the tx button if wrong chain; this allows the UI to remain unblocked in default state
      chainId: sellToken.chainId,
      swapperAccount: address || sellToken.whaleAddress,

      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps,
      mode: "exactIn" as const,
      inputAmount: parseTokenValue(numSellTokens, sellToken.decimals),
    }),
    [sellToken, buyToken, numSellTokens, slippageBps, address],
  );

  const query = useMemo(
    () => ({
      refetchInterval: QUOTE_REFRESH_INTERVAL_MS, // refetch to build quote history
      enabled: swap.inputAmount > 0n,
    }),
    [swap.inputAmount],
  );

  const {
    data: quotes,
    isFetching: isFetchingQuotes,
    error: quotesQueryError,
    dataUpdatedAt,
  } = useQuotes({
    swap,
    query,
    streamResults: true,
  });

  const bestQuote = getBestQuoteByMetric({
    quotes,
    metric: selectedMetric,
  });

  // when nothing is executable, surface a quote whose simulation reverted to explain why
  const failedSimQuote = !bestQuote
    ? quotes?.find((q): q is FailedSimulationQuote => q.success && !q.simulation.success)
    : undefined;

  // allowance is only read to explain simulation failures; approvals are
  // built by buildCalls below
  const allowanceQuote = bestQuote ?? failedSimQuote;
  const { data: allowance } = useAllowance({
    chainId: sellToken.chainId,
    owner: address,
    token: sellToken.address,
    spender: allowanceQuote
      ? (allowanceQuote.approval?.spender ?? allowanceQuote.txData.to)
      : undefined,
    enabled: isSupportedChain,
  });

  // derive all swap errors
  const errors: SwapErrorState = useMemo(() => {
    const state: SwapErrorState = {
      connection: [],
      input: [],
      quote: [],
      simulation: [],
      transaction: [],
    };

    if (!isConnected) {
      state.connection.push({
        title: "Connect wallet to swap",
        cause: "disconnected",
      });
    }

    if (isConnected && !isSupportedChain) {
      state.connection.push({
        title: "Unsupported chain",
        cause: "unsupported",
      });
    }

    const inputErrors = validateSwapInput(numSellTokens, sellTokenBalance, sellToken, buyToken);
    if (inputErrors) {
      state.input.push(...inputErrors);
    }

    if (quotesQueryError) {
      state.quote.push({
        title: "Failed to fetch quotes",
        description: "There was an error fetching quotes for this swap",
        details: quotesQueryError.message,
        cause: quotesQueryError,
      });
    }

    if (quotes?.length && !bestQuote && !failedSimQuote) {
      state.quote.push({
        title: "No valid quotes available",
        description: "All aggregators failed to return a quote",
        cause: quotes,
      });
    }

    if (failedSimQuote) {
      const reason = getSimulationFailureReason(failedSimQuote, allowance);
      state.simulation.push({
        title: reason || "Simulation failed",
        description: "This swap will likely fail if executed",
        details: failedSimQuote.simulation.error.message,
        cause: failedSimQuote.simulation,
      });
    }

    if (txError) {
      state.transaction.push(txError);
    }

    return state;
  }, [
    isConnected,
    isSupportedChain,
    numSellTokens,
    sellTokenBalance,
    sellToken,
    buyToken,
    quotes,
    quotesQueryError,
    bestQuote,
    failedSimQuote,
    allowance,
    txError,
  ]);

  const hasBlockingError = Boolean(
    errors.input.length || errors.quote.length || errors.simulation.length,
  );

  // build approval + swap calls with core's buildCalls: it checks the onchain
  // allowance, encodes the approval when needed, and applies simulated gas buffers
  const { data: builtCalls } = useQuery({
    queryKey: [
      "spandex",
      "buildCalls",
      bestQuote?.provider ?? null,
      bestQuote?.txData.to ?? null,
      bestQuote?.txData.data ?? null,
      swap.chainId,
      swap.swapperAccount,
      swap.inputAmount.toString(),
    ],
    queryFn: () =>
      buildCalls({
        quote: bestQuote as SuccessfulSimulatedQuote,
        swap: swap as SwapParams,
        config: spandexConfig,
        allowanceMode: "unlimited",
      }),
    enabled: Boolean(bestQuote),
  });

  const calls: TxData[] = useMemo(
    () =>
      (builtCalls ?? []).map((call) => ({
        ...call.txn,
        name: call.type === "approval" ? "APPROVE" : "SELL",
        chainId: swap.chainId,
      })),
    [builtCalls, swap.chainId],
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

      onSuccessfulTx();
    },
    [chainId, bestQuote, swap.inputAmount, onSuccessfulTx],
  );

  return (
    <div className="flex flex-col gap-20">
      <SwapControls
        bestQuote={bestQuote}
        sellToken={sellToken}
        balances={balances}
        isLoadingBalances={isLoadingBalances}
        numSellTokens={numSellTokens}
        setNumSellTokens={setNumSellTokens}
        buyToken={buyToken}
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
        isFetchingQuotes={isFetchingQuotes}
        dataUpdatedAt={dataUpdatedAt}
        refreshIntervalMs={QUOTE_REFRESH_INTERVAL_MS}
      />
      <hr className="border-primary" />
      <TxBatchButton
        blocked={calls.length === 0 || hasBlockingError}
        isFetchingQuotes={isFetchingQuotes}
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
