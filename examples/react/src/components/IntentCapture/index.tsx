import { ClientOnly } from "@tanstack/react-router";
import { useQuotes } from "@withfabric/spandex-react";
import { useMemo, useState } from "react";
import { type Address, encodeFunctionData, erc20Abi, type Hex, maxUint256 } from "viem";
import { useConnection } from "wagmi";
import { useAllowance } from "@/hooks/useAllowance";
import { useBalance } from "@/hooks/useBalance";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import { formatTokenValue } from "@/utils/strings";
import { BumpChart } from "./BumpChart";
import { BuyToken } from "./BuyToken";
import { LineItems } from "./LineItems";
import { SellToken } from "./SellToken";
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
  const { sellToken, buyToken } = useTokenSelect();
  const { address, chainId } = useConnection();
  const [numSellTokens, setNumSellTokens] = useState<string>("20");

  const {
    data: inputBalance,
    isLoading: inputBalanceLoading,
    // error: inputBalanceError,
  } = useBalance({
    chainId: chainId,
    owner: address,
    token: sellToken.address,
  });
  const {
    data: outputBalance,
    isLoading: outputBalanceLoading,
    // error: outputBalanceError,
  } = useBalance({
    chainId: chainId,
    owner: address,
    token: buyToken.address,
  });

  // TODO: balance errors
  const isLoadingBalances = inputBalanceLoading || outputBalanceLoading;

  const swapParams = useMemo(() => {
    return {
      chainId,
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps: 100,
      mode: "exactIn" as const,
      inputAmount: BigInt(Number(numSellTokens) * 10 ** sellToken.decimals),
    };
  }, [sellToken, buyToken, numSellTokens, chainId]);

  const {
    data,
    isLoading: quotesLoading,
    error: quotesError,
  } = useQuotes({
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

  // TODO: handle loading and error states
  const { quotes /*, isLoading, error*/, calls } = useMemo(() => {
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

    const isLoading = quotesLoading || allowanceLoading;
    const error = quotesError || allowanceError; // TODO: real errors

    return {
      quotes: data,
      calls,
      isLoading,
      error,
    };
  }, [
    firstSuccess,
    allowance,
    swapParams.chainId,
    sellToken.address,
    quotesLoading,
    allowanceLoading,
    quotesError,
    allowanceError,
    data,
  ]);

  const numBuyTokens = useMemo(() => {
    const bestQuote = quotes
      ?.filter((q) => q.success)
      .sort((a, b) => Number(b.outputAmount) - Number(a.outputAmount))[0];

    // convert to <input /> value
    if (bestQuote?.success) {
      const outputDecimal = Number(bestQuote.outputAmount) / 10 ** buyToken.decimals;
      return outputDecimal.toString();
    }

    return "";
  }, [quotes, buyToken.decimals]);

  return (
    <ClientOnly>
      <div className="flex flex-col gap-20">
        <SellToken
          token={sellToken}
          isLoadingBalances={isLoadingBalances}
          balance={formatTokenValue(BigInt(inputBalance || "0"), sellToken.decimals)}
          numTokens={numSellTokens}
          onChange={setNumSellTokens}
        />
        <BuyToken
          token={buyToken}
          isLoadingBalances={isLoadingBalances}
          balance={formatTokenValue(BigInt(outputBalance || "0"), buyToken.decimals)}
          numTokens={numBuyTokens}
        />
        <hr className="block bg-primary" />
        <BumpChart
          quotes={quotes}
          sellToken={sellToken}
          buyToken={buyToken}
          numSellTokens={numSellTokens}
        />
        <hr className="block bg-primary" />
        <LineItems quote={quotes?.[0]} inputToken={sellToken} outputToken={buyToken} />
        <hr className="block bg-primary" />
        {calls.length && (
          <TxBatchButton variant="sell" blocked={calls.length === 0} calls={calls} />
        )}
      </div>
    </ClientOnly>
  );
}
