import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import { Button } from "../Button";

type BuyTokenProps = {
  token: TokenMetadata;
  balance?: string;
  isLoadingBalances: boolean;
  numTokens: string;
};

export function BuyToken({ token, balance, isLoadingBalances, numTokens }: BuyTokenProps) {
  const { openDrawer } = useTokenSelect();

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
        <Button onClick={() => openDrawer("buy")}>
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
        {isLoadingBalances ? "Loading..." : balance || "0"} {token.symbol}
      </span>
    </div>
  );
}
