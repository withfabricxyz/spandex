import { ClientOnly } from "@tanstack/react-router";
import { useQuotes } from "@withfabric/spandex-react";
import { useCallback, useMemo, useState } from "react";
import { type Address, encodeFunctionData, erc20Abi, type Hex, maxUint256 } from "viem";
import { useConnection } from "wagmi";
import { useAllowance } from "@/hooks/useAllowance";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import { Insights, type Metric } from "./Insights";
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

  const swap = useMemo(
    () => ({
      chainId,
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps: 100,
      mode: "exactIn" as const,
      inputAmount: BigInt(Number(numSellTokens) * 10 ** sellToken.decimals),
    }),
    [sellToken, buyToken, numSellTokens, chainId],
  );

  const {
    data: quotes,
    isLoading: isLoadingQuotes,
    // error: quotesError,
  } = useQuotes({
    swap,
    query: {
      refetchInterval: 2500,
    },
  });

  // TODO: select best
  const best = quotes?.find((quote) => quote.success);

  const {
    data: allowance,
    // isLoading: allowanceLoading,
    // error: allowanceError,
  } = useAllowance({
    chainId,
    owner: address,
    token: sellToken.address,
    spender: best?.txData.to,
  });

  // TODO: handle loading and error states
  const calls = useMemo(() => {
    if (!chainId) return [];

    const calls: TxData[] = [];
    const inputAmount = BigInt(best?.inputAmount || 0);

    if (best?.txData.data) {
      const spender = best.txData.to;
      const currentAllowance = BigInt(allowance || 0);
      const isApprovalRequired = inputAmount > 0n && currentAllowance < inputAmount;

      if (isApprovalRequired) {
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
        to: best.txData.to,
        name: "SELL",
        data: best.txData.data,
        chainId,
        value: BigInt(best.txData.value || 0),
      });
    }

    return calls;
  }, [best, allowance, chainId, sellToken.address]);

  const onSwitchTokens = useCallback(() => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
  }, [buyToken, sellToken, setSellToken, setBuyToken]);

  return (
    <ClientOnly>
      <div className="flex flex-col gap-20">
        <SwapControls
          bestQuote={best}
          sellToken={sellToken}
          numSellTokens={numSellTokens}
          setNumSellTokens={setNumSellTokens}
          buyToken={buyToken}
          isLoadingQuotes={isLoadingQuotes}
          onSwitchTokens={onSwitchTokens}
        />
        <hr className="block bg-primary" />
        <Insights
          quotes={quotes}
          sellToken={sellToken}
          buyToken={buyToken}
          numSellTokens={numSellTokens}
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
        />
        <hr className="block bg-primary" />
        <TxBatchButton variant="sell" blocked={calls.length === 0} calls={calls} />
      </div>
    </ClientOnly>
  );
}
