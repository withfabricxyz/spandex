import { ClientOnly } from "@tanstack/react-router";
import { useQuotes } from "@withfabric/spandex-react";
import { useCallback, useMemo, useState } from "react";
import { type Address, encodeFunctionData, erc20Abi, type Hex, maxUint256 } from "viem";
import { useConnection } from "wagmi";
import { getExplorerLink } from "@/config/onchain";
import { useAllowance } from "@/hooks/useAllowance";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import { getBestQuoteByMetric, type Metric } from "@/utils/quoteHelpers";
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
  afterSubmit?: () => Promise<void>; // Optional callback after submission
};

export function IntentCapture() {
  const { sellToken, setSellToken, buyToken, setBuyToken } = useTokenSelect();
  const { address, chainId } = useConnection();
  const [numSellTokens, setNumSellTokens] = useState<string>("20");
  const [selectedMetric, setSelectedMetric] = useState<Metric>("price");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [showSuccessSplash, setShowSuccessSplash] = useState<boolean>(false);
  const [successfulTx, setSuccessfulTx] = useState<{
    hash: `0x${string}`;
    chainId: number;
    inputAmount: bigint;
    outputAmount: bigint;
  } | null>(null);

  const swap = useMemo(
    () => ({
      chainId,
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps,
      mode: "exactIn" as const,
      inputAmount: BigInt(Number(numSellTokens) * 10 ** sellToken.decimals),
    }),
    [sellToken, buyToken, numSellTokens, chainId, slippageBps],
  );

  const query = useMemo(
    () => ({
      refetchInterval: 2500, // refetch to build quote history
      enabled: swap.inputAmount > 0n && !!chainId && !!address,
    }),
    [swap.inputAmount, chainId, address],
  );

  const { data: quotes, isLoading: isLoadingQuotes } = useQuotes({
    swap,
    query,
  });

  // TODO: useBestQuote?
  const bestQuote = getBestQuoteByMetric({
    quotes: quotes || [],
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
    const currentAllowance = BigInt(allowance || 0);

    return inputAmount > 0n && currentAllowance < inputAmount;
  }, [bestQuote, allowance]);

  const calls = useMemo(() => {
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
          to: sellToken.address,
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
  }, [bestQuote, needsApproval, chainId, sellToken.address]);

  const onSwitchTokens = useCallback(() => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
  }, [buyToken, sellToken, setSellToken, setBuyToken]);

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
        outputAmount: BigInt(bestQuote.txData.value || 0),
      });

      setShowSuccessSplash(true);
    },
    [chainId, bestQuote, swap.inputAmount],
  );

  return (
    <ClientOnly>
      <div className="flex flex-col gap-20">
        <SwapControls
          bestQuote={bestQuote}
          sellToken={sellToken}
          numSellTokens={numSellTokens}
          setNumSellTokens={setNumSellTokens}
          buyToken={buyToken}
          isLoadingQuotes={isLoadingQuotes}
          onSwitchTokens={onSwitchTokens}
        />
        <hr className="block h-1 bg-primary" />
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
          currentAllowance={allowance}
        />
        <hr className="block h-1 bg-primary" />
        <TxBatchButton blocked={calls.length === 0} calls={calls} onComplete={onComplete} />
      </div>
      {/* TODO: simplify condition */}
      {showSuccessSplash && address && successfulTx ? (
        <SuccessSplash
          sellToken={sellToken}
          buyToken={buyToken}
          onClose={() => setShowSuccessSplash(false)}
          successfulTx={successfulTx}
        />
      ) : null}
    </ClientOnly>
  );
}
