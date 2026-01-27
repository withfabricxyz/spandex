import { useCallback } from "react";
import { ChevronDown } from "@/components/icons";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import type { StructuredError } from "@/utils/errors";
import { bigintToDecimalString, formatTokenValue } from "@/utils/strings";
import { Button } from "../../Button";

type SellTokenProps = {
  token: TokenMetadata;
  balance?: bigint;
  isLoadingBalances: boolean;
  numTokens: string;
  onChange: (value: string) => void;
  error?: StructuredError;
};

export function SellToken({
  token,
  balance,
  isLoadingBalances,
  numTokens,
  onChange,
  error,
}: SellTokenProps) {
  const { openDrawer } = useTokenSelect();

  const handlePercentClick = useCallback(
    (percent: string) => {
      if (!balance) return;

      let newValue = "0";

      if (percent === "max") {
        newValue = bigintToDecimalString(balance, token.decimals);
      } else {
        const fraction = BigInt(parseInt(percent, 10));
        const percentAmount = (balance * fraction) / 100n;
        newValue = bigintToDecimalString(percentAmount, token.decimals);
      }

      onChange(newValue);
    },
    [balance, token.decimals, onChange],
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-10">
        <span className="text-secondary">Sell</span>
        {["25%", "50%", "Max"].map((label) => (
          <button
            className="text-quaternary hover:text-secondary cursor-pointer select-none"
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
          className={`w-full text-primary text-[56px] leading-1 h-22 outline-0 ${error ? "text-red" : ""}`}
          value={numTokens}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button onClick={() => openDrawer("sell")}>
          <div className="flex items-center gap-4 pr-4">
            <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
            <span className=" text-[20px]">{token.symbol}</span>
            <div className="h-12 w-12 flex items-center">
              <ChevronDown fill="var(--color-primary)" />
            </div>
          </div>
        </Button>
      </div>
      <span className={`text-quaternary monospace text-[12px] ${error ? "text-red" : ""}`}>
        {isLoadingBalances ? "Loading..." : formatTokenValue(balance || 0n, token.decimals)}{" "}
        {token.symbol}
      </span>
    </div>
  );
}
