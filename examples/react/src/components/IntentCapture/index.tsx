import type { SimulatedQuote } from "@withfabric/spandex";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import { useSwap } from "@/hooks/useSwap";
import { useTokenDrawer } from "@/providers/TokenDrawerProvider";
import type { TokenMetadata } from "@/services/tokens";
import { formatTokenValue } from "@/utils/strings";
import { Button } from "../Button";
import { BumpChart } from "./BumpChart";
import { LineItems } from "./LineItems";
import { TxBatchButton } from "./TxBatchButton";

type TokenControlProps = {
  token: TokenMetadata;
  balance?: string;
  numTokens: string;
  onChange: (value: string) => void;
};

function SellToken({ token, balance, numTokens, onChange }: TokenControlProps) {
  const { setIsDrawerOpen } = useTokenDrawer();

  const handlePercentClick = useCallback(
    (percent: string) => {
      if (!balance) return;

      const balanceNum = Number(balance);
      let newValue = "0";

      if (percent === "max") {
        newValue = balanceNum.toString();
      } else {
        const fraction = parseInt(percent, 10) / 100;
        newValue = (balanceNum * fraction).toString();
      }

      onChange(newValue);
    },
    [balance, onChange],
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-10">
        <span className="text-secondary-1">Sell</span>
        {["25%", "50%", "Max"].map((label) => (
          <button
            className="text-tertiary hover:text-secondary-1 cursor-pointer select-none"
            type="button"
            key={label}
            onClick={() => handlePercentClick(label.toLowerCase())}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <input
          type="text"
          className="w-full text-primary text-[56px] leading-1 h-22"
          value={numTokens}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button onClick={() => setIsDrawerOpen(true)}>
          <div className="flex items-center gap-4 pr-4">
            <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
            <span className="font-['Sohne_Breit'] text-[20px]">{token.symbol}</span>
            <div className="h-12 w-12 flex items-center">
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: <> */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
              >
                <path d="M6 7.4L0 1.4L1.4 0L6 4.6L10.6 0L12 1.4L6 7.4Z" fill="#0F0F0F" />
              </svg>
            </div>
          </div>
        </Button>
      </div>
      <span className="text-tertiary font-['Sohne_Mono'] text-[12px]">
        {balance || "0"} {token.symbol}
      </span>
    </div>
  );
}

function BuyToken({ token, balance, numTokens }: Omit<TokenControlProps, "onChange">) {
  const { setIsDrawerOpen } = useTokenDrawer();

  return (
    <div className="flex flex-col gap-10">
      <span className="text-secondary-1">Buy</span>
      <div className="flex justify-between items-center">
        <input
          type="text"
          className="w-full text-primary text-[56px] leading-1 h-22"
          style={{ maxWidth: "calc(100% - 176px)" }}
          value={numTokens}
          readOnly
        />
        <Button onClick={() => setIsDrawerOpen(true)}>
          <div className="flex items-center gap-4 pr-4">
            <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
            <span className="font-['Sohne_Breit'] text-[20px]">{token.symbol}</span>
            <div className="h-12 w-12 flex items-center">
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: <> */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
              >
                <path d="M6 7.4L0 1.4L1.4 0L6 4.6L10.6 0L12 1.4L6 7.4Z" fill="#0F0F0F" />
              </svg>
            </div>
          </div>
        </Button>
      </div>
      <span className="text-tertiary font-['Sohne_Mono'] text-[12px]">
        {balance || "0"} {token.symbol}
      </span>
    </div>
  );
}

type SwapParams = {
  inputToken: Address;
  outputToken: Address;
  chainId?: number;
  slippageBps: number;
  swapperAccount?: Address;
  amount: bigint;
  mode: "exactIn" | "targetOut";
};

function _SwapButton({ swapParams }: { swapParams: SwapParams }) {
  return (
    <TxBatchButton
      variant="sell"
      blocked={false}
      calls={[
        {
          name: "Swap",
          to: "0x0000000000000000000000000000000000000000",
          data: "0x",
          chainId: swapParams.chainId || 1,
        },
      ]}
    />
  );
}

export function IntentCapture({
  sellToken,
  buyToken,
}: {
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
}) {
  const { address, chainId } = useConnection();
  const [numSellTokens, setNumSellTokens] = useState<string>("20");
  const [quoteHistory, setQuoteHistory] = useState<SimulatedQuote[][]>([]);

  const { quotes, inputBalance, outputBalance, derivedMetrics } = useSwap({
    chainId: chainId,
    address: address,
    sellToken,
    numSellTokens,
    buyToken,
  });

  const numBuyTokens = useMemo(() => {
    const bestQuote = quotes
      ?.filter((q) => q.success)
      .sort((a, b) => Number(b.outputAmount) - Number(a.outputAmount))[0];

    // Convert outputAmount from base units to decimal
    if (bestQuote?.success) {
      const outputDecimal = Number(bestQuote.outputAmount) / 10 ** buyToken.decimals;
      return outputDecimal.toString();
    }

    return "";
  }, [quotes, buyToken.decimals]);

  // reset history when swap parameters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally resetting on input changes
  useEffect(() => {
    setQuoteHistory([]);
  }, [sellToken.address, buyToken.address, numSellTokens]);

  // store quotes in history whenever we get a new set of quotes
  useEffect(() => {
    if (quotes && quotes.length > 0) {
      setQuoteHistory((prev) => [...prev, quotes].slice(-20)); // limit to last 20?
    }
  }, [quotes]);

  const _swapParams = useMemo(
    () => ({
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps: 100,
      amount: BigInt(Number(numSellTokens || "0") * 10 ** sellToken.decimals),
    }),
    [sellToken, buyToken, numSellTokens],
  );

  return (
    <div className="flex flex-col gap-20">
      <hr className="block bg-primary" />
      <SellToken
        token={sellToken}
        balance={formatTokenValue(BigInt(inputBalance || "0"), sellToken.decimals)}
        numTokens={numSellTokens}
        onChange={setNumSellTokens}
      />
      <BuyToken
        token={buyToken}
        balance={formatTokenValue(BigInt(outputBalance || "0"), buyToken.decimals)}
        numTokens={numBuyTokens}
      />
      <hr className="block bg-primary" />
      <BumpChart history={quoteHistory} />
      <hr className="block bg-primary" />
      <LineItems
        quote={quotes?.[0]}
        inputToken={sellToken}
        outputToken={buyToken}
        derivedMetrics={derivedMetrics}
      />
      <hr className="block bg-primary" />
      {/* <SwapButton swapParams={swapParams} /> */}
    </div>
  );
}
