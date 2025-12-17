import { useCallback } from "react";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import { Button } from "../Button";

type SellTokenProps = {
  token: TokenMetadata;
  balance?: string;
  isLoadingBalances: boolean;
  numTokens: string;
  onChange: (value: string) => void;
};

export function SellToken({
  token,
  balance,
  isLoadingBalances,
  numTokens,
  onChange,
}: SellTokenProps) {
  const { openDrawer } = useTokenSelect();

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
          className="w-full text-primary text-[56px] leading-1 h-22 outline-0"
          value={numTokens}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button onClick={() => openDrawer("sell")}>
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
