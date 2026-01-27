import type { SimulatedQuote } from "@spandex/core";
import { useEffect, useMemo } from "react";
import { useConnection } from "wagmi";
import { ArrowsUpDown } from "@/components/icons";
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

    // use wallet balance if positive and less than default, otherwise use sellToken default
    const amount = sellBalance > 0n && sellBalance < defaultAmount ? sellBalance : defaultAmount;

    setNumSellTokens(bigintToDecimalString(amount, sellToken.decimals));
  }, [isConnected, balances.sellToken, sellToken, setNumSellTokens]);

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
      onSwitchTokens={onSwitchTokens}
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
        // simulation error can be related to input
        error={errors?.input || errors?.simulation}
      />

      <TokenSwitcher
        canSwitch={!!balances.buyToken && balances.buyToken > 0n}
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

function TokenSwitcher({ canSwitch, onSwitch }: { canSwitch: boolean; onSwitch: () => void }) {
  if (!canSwitch) return null;

  return (
    <button
      type="button"
      className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center cursor-pointer"
      onClick={onSwitch}
    >
      <ArrowsUpDown className="fill-tertiary" />
    </button>
  );
}

export { SwapControlsLoader as SwapControls };
