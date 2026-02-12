import { ChevronDown } from "@/components/icons";
import { TokenImage } from "@/components/TokenImage";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import { Button } from "../../Button";
import { Skeleton } from "../../Skeleton";

type BuyTokenProps = {
  token: TokenMetadata;
  balance?: string;
  isLoadingBalances: boolean;
  numTokens: string;
};

export function BuyToken({ token, balance, isLoadingBalances, numTokens }: BuyTokenProps) {
  const { openDrawer } = useTokenSelect();
  const noQuote = Number(numTokens) === 0;

  return (
    <div className="flex flex-col gap-10">
      <span className="text-secondary">Buy</span>
      <div className="flex justify-between items-center">
        {noQuote ? (
          <Skeleton height={44} width="calc(100% - 176px)" />
        ) : (
          <input
            type="text"
            className="w-full text-primary text-[56px] leading-1 h-22 outline-none"
            style={{ maxWidth: "calc(100% - 176px)" }}
            value={numTokens}
            readOnly
          />
        )}
        <Button onClick={() => openDrawer("buy")} variant="secondary">
          <div className="flex items-center gap-4">
            <TokenImage token={token} size="sm" />
            <span className="text-[20px]">{token.symbol}</span>
            <div className="h-12 w-12 relative">
              <ChevronDown
                fill="var(--color-primary)"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </div>
          </div>
        </Button>
      </div>
      <span className="text-quaternary monospace text-[12px]">
        {isLoadingBalances ? "Loading..." : balance || "0"} {token.symbol}
      </span>
    </div>
  );
}
