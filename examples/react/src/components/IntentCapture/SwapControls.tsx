import type { SimulatedQuote } from "@withfabric/spandex";
import { useEffect, useMemo } from "react";
import { useConnection } from "wagmi";
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

function TokenSwitcher({ canSwitch, onSwitch }: { canSwitch: boolean; onSwitch: () => void }) {
  if (!canSwitch) return null;

  return (
    <button
      type="button"
      className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center cursor-pointer"
      onClick={onSwitch}
    >
      {/** biome-ignore lint/a11y/noSvgWithoutTitle: <> */}
      <svg
        className="fill-tertiary"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
      >
        <path d="M16 15L11 20L6 15L7.425 13.6L10 16.175V9H12V16.175L14.575 13.6L16 15ZM10 5L8.575 6.4L6 3.825V11H4V3.825L1.425 6.4L0 5L5 0L10 5Z" />
      </svg>
    </button>
  );
}

export function SwapControls({
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
