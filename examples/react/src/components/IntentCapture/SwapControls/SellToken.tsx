import { useCallback } from "react";
import { ChevronDown } from "@/components/icons";
import { Skeleton } from "@/components/Skeleton";
import { TokenImage } from "@/components/TokenImage";
import type { BalancePercent } from "@/providers/TokenSelectProvider";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import type { SwapErrorState } from "@/utils/errors";
import { bigintToDecimalString, formatTokenValue } from "@/utils/strings";
import { Button } from "../../Button";

type SellTokenProps = {
  token: TokenMetadata;
  balance?: bigint;
  isLoadingBalances: boolean;
  numTokens: string;
  onChange: (value: string) => void;
  activePercent: BalancePercent;
  onPercentChange: (percent: BalancePercent) => void;
  errors?: SwapErrorState;
  isInvalidPair?: boolean;
};

export function SellToken({
  token,
  balance,
  isLoadingBalances,
  numTokens,
  onChange,
  activePercent,
  onPercentChange,
  errors,
}: SellTokenProps) {
  const { openDrawer, setActivePercent } = useTokenSelect();
  const isInvalidPair = errors?.input.some((e) => e.cause === "invalid-token-pair");

  const handlePercentClick = useCallback(
    (percent: string) => {
      if (!balance) return;

      const normalizedPercent = percent.toLowerCase() as BalancePercent;
      onPercentChange(normalizedPercent);

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
    [balance, token.decimals, onChange, onPercentChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setActivePercent("0%");
      onChange(e.target.value);
    },
    [onChange, setActivePercent],
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-10">
        <span className="text-secondary">Sell</span>
        {["25%", "50%", "max"].map((label) => (
          <button
            className={`capitalize text-quaternary hover:text-secondary cursor-pointer select-none ${activePercent === label.toLowerCase() ? "text-secondary" : ""}`}
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
            className={`w-full text-primary text-[56px] leading-1 h-22 outline-none ${errors?.input.length && !isInvalidPair ? "text-red" : ""}`}
            style={{ maxWidth: "calc(100% - 176px)" }}
            value={numTokens}
            onChange={handleChange}
          />
        )}

        <Button
          onClick={() => openDrawer("sell")}
          variant="secondary"
          className={isInvalidPair ? "border-red text-red" : ""}
        >
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
      <span
        className={`text-quaternary monospace text-[12px] ${errors?.input.some((e) => e.cause === "balance") ? "text-red" : ""}`}
      >
        {isLoadingBalances ? "Loading..." : formatTokenValue(balance || 0n, token.decimals)}{" "}
        {token.symbol}
      </span>
    </div>
  );
}
