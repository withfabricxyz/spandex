import type { SimulatedQuote } from "@spandex/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { Button } from "@/components/Button";
import { ArrowsUpDown } from "@/components/icons";
import { Tooltip } from "@/components/Tooltip";
import { type BalancePercent, useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import type { SwapErrorState } from "@/utils/errors";
import { bigintToDecimalString, formatTokenValue, parseTokenValue } from "@/utils/strings";
import { BuyToken } from "./BuyToken";
import { SellToken } from "./SellToken";

type SwapControlsProps = {
  bestQuote?: SimulatedQuote;
  sellToken: TokenMetadata;
  balances: {
    sellToken?: bigint;
    buyToken?: bigint;
  };
  isLoadingBalances: boolean;
  numSellTokens: string;
  setNumSellTokens: (value: string) => void;
  buyToken: TokenMetadata;
  isLoadingQuotes: boolean;
  onSwitchTokens: () => void;
  errors?: SwapErrorState;
};

type SwapControlsInputsProps = SwapControlsProps & {
  numBuyTokens: string;
  activePercent: BalancePercent;
  onPercentChange: (percent: BalancePercent) => void;
};

// SwapControls - renders token controls with hoisted balance from IntentCapture
function SwapControlsLoader({
  bestQuote,
  sellToken,
  balances,
  isLoadingBalances,
  numSellTokens,
  setNumSellTokens,
  buyToken,
  isLoadingQuotes,
  onSwitchTokens,
  errors,
}: SwapControlsProps) {
  const { isConnected } = useConnection();
  const { activePercent, setActivePercent } = useTokenSelect();

  const numBuyTokens = useMemo(() => {
    // convert to <input /> value
    if (bestQuote?.success) {
      const outputDecimal = Number(bestQuote.outputAmount) / 10 ** buyToken.decimals;
      return outputDecimal.toString();
    }

    return "";
  }, [bestQuote, buyToken.decimals]);

  useEffect(() => {
    if (!isConnected) return;

    const defaultAmount = parseTokenValue(sellToken.defaultInput, sellToken.decimals);
    const sellBalance = balances.sellToken ?? 0n;

    const percentMap: Record<BalancePercent, bigint> = {
      "0%": 0n,
      "25%": sellBalance / 4n,
      "50%": sellBalance / 2n,
      max: sellBalance,
    };

    const balancePreset = percentMap[activePercent];

    // use wallet balance if exists, fallback to token default
    const amount = sellBalance > 0n ? balancePreset : defaultAmount;

    setNumSellTokens(bigintToDecimalString(amount, sellToken.decimals));
  }, [isConnected, balances.sellToken, sellToken, setNumSellTokens, activePercent]);

  const handleSwitchTokens = useCallback(() => {
    setActivePercent("25%");
    onSwitchTokens();
  }, [onSwitchTokens, setActivePercent]);

  return (
    <Inputs
      bestQuote={bestQuote}
      sellToken={sellToken}
      balances={balances}
      isLoadingBalances={isLoadingBalances}
      numSellTokens={numSellTokens}
      setNumSellTokens={setNumSellTokens}
      buyToken={buyToken}
      numBuyTokens={numBuyTokens}
      isLoadingQuotes={isLoadingQuotes}
      onSwitchTokens={handleSwitchTokens}
      activePercent={activePercent}
      onPercentChange={setActivePercent}
      errors={errors}
    />
  );
}

function Inputs({
  sellToken,
  balances,
  isLoadingBalances,
  numSellTokens,
  setNumSellTokens,
  buyToken,
  numBuyTokens,
  isLoadingQuotes,
  onSwitchTokens,
  activePercent,
  onPercentChange,
  errors,
}: SwapControlsInputsProps) {
  return (
    <div className="relative flex flex-col gap-20">
      <SellToken
        token={sellToken}
        balance={balances.sellToken}
        isLoadingBalances={isLoadingBalances}
        numTokens={numSellTokens}
        onChange={setNumSellTokens}
        activePercent={activePercent}
        onPercentChange={onPercentChange}
        errors={errors}
      />

      <TokenSwitcher
        canSwitch={!!balances.buyToken && balances.buyToken > 0n}
        buyToken={buyToken}
        onSwitch={onSwitchTokens}
      />

      <BuyToken
        token={buyToken}
        balance={formatTokenValue(BigInt(balances.buyToken || 0n), buyToken.decimals)}
        isLoadingQuotes={isLoadingQuotes}
        numTokens={numBuyTokens}
        isLoadingBalances={isLoadingBalances}
      />
    </div>
  );
}

function TokenSwitcher({
  canSwitch,
  buyToken,
  onSwitch,
}: {
  canSwitch: boolean;
  buyToken: TokenMetadata;
  onSwitch: () => void;
}) {
  const [rotation, setRotation] = useState(0);

  const handleSwitch = useCallback(() => {
    setRotation((prev) => prev + 180);
    onSwitch();
  }, [onSwitch]);

  return (
    <Tooltip
      trigger={
        <Button
          variant="secondary"
          className="absolute px-2 py-4 border-0 right-0 top-1/2 -translate-y-1/2 h-16 w-16 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          onClick={handleSwitch}
          disabled={!canSwitch}
        >
          <ArrowsUpDown
            className="fill-quaternary transition-transform duration-175 ease-in-out pointer-events-none"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </Button>
      }
      content={canSwitch ? "Switch tokens" : `Not enough ${buyToken.symbol}`}
    />
  );
}

export { SwapControlsLoader as SwapControls };
