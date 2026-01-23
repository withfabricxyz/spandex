import type { SimulatedQuote } from "@withfabric/spandex";
import { useEffect, useMemo } from "react";
import { useConnection } from "wagmi";
import { ArrowsUpDown } from "@/components/icons";
import { useBalance } from "@/hooks/useBalance";
import type { TokenMetadata } from "@/services/tokens";
import { formatTokenValue } from "@/utils/strings";
import { BuyToken } from "./BuyToken";
import { SellToken } from "./SellToken";

type SwapControlsProps = {
  bestQuote?: SimulatedQuote;
  sellToken: TokenMetadata;
  numSellTokens: string;
  setNumSellTokens: (value: string) => void;
  buyToken: TokenMetadata;
  isLoadingQuotes: boolean;
  onSwitchTokens: () => void;
};

type SwapControlsInputsProps = SwapControlsProps & {
  numBuyTokens: string;
  inputBalance?: bigint;
  outputBalance?: bigint;
  isLoadingBalances: boolean;
};

// SwapControls - loads balances, renders token controls. The loader does all required
// fetching/loading and wraps the inputs
function SwapControlsLoader({
  bestQuote,
  sellToken,
  numSellTokens,
  setNumSellTokens,
  buyToken,
  isLoadingQuotes,
  onSwitchTokens,
}: SwapControlsProps) {
  const { chainId, address } = useConnection();

  const numBuyTokens = useMemo(() => {
    // convert to <input /> value
    if (bestQuote?.success) {
      const outputDecimal = Number(bestQuote.outputAmount) / 10 ** buyToken.decimals;
      return outputDecimal.toString();
    }

    return "";
  }, [bestQuote, buyToken.decimals]);

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

  // TODO: make better? when switching tokens, set the initial sell value to max?
  useEffect(() => {
    setNumSellTokens(formatTokenValue(BigInt(inputBalance || "0"), sellToken.decimals));
  }, [inputBalance, setNumSellTokens, sellToken.decimals]);

  const isLoadingBalances = inputBalanceLoading || outputBalanceLoading;

  return (
    <Inputs
      sellToken={sellToken}
      numSellTokens={numSellTokens}
      setNumSellTokens={setNumSellTokens}
      buyToken={buyToken}
      numBuyTokens={numBuyTokens}
      isLoadingQuotes={isLoadingQuotes}
      inputBalance={inputBalance}
      outputBalance={outputBalance}
      isLoadingBalances={isLoadingBalances}
      onSwitchTokens={onSwitchTokens}
    />
  );
}

function Inputs({
  sellToken,
  numSellTokens,
  setNumSellTokens,
  buyToken,
  numBuyTokens,
  isLoadingQuotes,
  inputBalance,
  outputBalance,
  isLoadingBalances,
  onSwitchTokens,
}: SwapControlsInputsProps) {
  return (
    <div className="relative flex flex-col gap-20">
      <SellToken
        token={sellToken}
        balance={formatTokenValue(BigInt(inputBalance || "0"), sellToken.decimals)}
        isLoadingBalances={isLoadingBalances}
        numTokens={numSellTokens}
        onChange={setNumSellTokens}
      />

      <TokenSwitcher canSwitch={!!outputBalance && outputBalance > 0n} onSwitch={onSwitchTokens} />

      <BuyToken
        token={buyToken}
        balance={formatTokenValue(BigInt(outputBalance || "0"), buyToken.decimals)}
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
