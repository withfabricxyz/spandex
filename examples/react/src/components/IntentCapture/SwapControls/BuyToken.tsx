import { ChevronDown } from "@/components/icons";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import { Button } from "../../Button";
import { Skeleton } from "../../Skeleton";

type BuyTokenProps = {
  token: TokenMetadata;
  balance?: string;
  isLoadingQuotes: boolean;
  isLoadingBalances: boolean;
  numTokens: string;
};

export function BuyToken({
  token,
  balance,
  isLoadingQuotes,
  isLoadingBalances,
  numTokens,
}: BuyTokenProps) {
  const { openDrawer } = useTokenSelect();

  return (
    <div className="flex flex-col gap-10">
      <span className="text-secondary-1">Buy</span>
      <div className="flex justify-between items-center">
        {isLoadingQuotes ? (
          <Skeleton height={44} width="calc(100% - 176px)" />
        ) : (
          <input
            type="text"
            className="w-full text-primary text-[56px] leading-1 h-22"
            style={{ maxWidth: "calc(100% - 176px)" }}
            value={numTokens}
            readOnly
          />
        )}
        <Button onClick={() => openDrawer("buy")}>
          <div className="flex items-center gap-4 pr-4">
            <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
            <span className="font-['Sohne_Breit'] text-[20px]">{token.symbol}</span>
            <div className="h-12 w-12 flex items-center">
              <ChevronDown />
            </div>
          </div>
        </Button>
      </div>
      <span className="text-tertiary font-['Sohne_Mono'] text-[12px]">
        {isLoadingBalances ? "Loading..." : balance || "0"} {token.symbol}
      </span>
    </div>
  );
}
