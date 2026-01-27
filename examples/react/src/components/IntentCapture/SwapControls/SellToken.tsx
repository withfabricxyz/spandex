import { useCallback } from "react";
import { ChevronDown } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { TokenImage } from "@/components/TokenImage";
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
        {isLoadingBalances ? (
          <Skeleton height={44} width="calc(100% - 176px)" />
        ) : (
          <input
            type="text"
            className={`w-full text-primary text-[56px] leading-1 h-22 outline-none ${error ? "text-red" : ""}`}
            style={{ maxWidth: "calc(100% - 176px)" }}
            value={numTokens}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        <Button onClick={() => openDrawer("sell")} variant="secondary">
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
      <span className={`text-quaternary monospace text-[12px] ${error ? "text-red" : ""}`}>
        {isLoadingBalances ? "Loading..." : formatTokenValue(balance || 0n, token.decimals)}{" "}
        {token.symbol}
      </span>
    </div>
  );
}
