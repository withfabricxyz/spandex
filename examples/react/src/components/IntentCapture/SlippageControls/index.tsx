import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Close } from "@/components/icons";
import type { TokenMetadata } from "@/services/tokens";
import { formatTokenValue } from "@/utils/strings";

export function SlippageControls({
  sellToken,
  numSellTokens,
  slippageBps,
  setSlippageBps,
}: {
  sellToken: TokenMetadata;
  numSellTokens: string;
  slippageBps: number;
  setSlippageBps: (value: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState<string>("1");
  const inputRef = useRef<HTMLInputElement>(null);
  const slippagePercent = slippageBps / 100;

  // value of slippage, denominated in sell token, based on passed slippage setting or current input (if editing)
  const slippageTokenValue = useMemo(() => {
    const base = isEditing ? inputValue : slippagePercent;
    const amount = BigInt(
      Math.round((Number(numSellTokens) / 100) * Number(base) * 10 ** sellToken.decimals),
    );

    return formatTokenValue(amount, sellToken.decimals);
  }, [numSellTokens, slippagePercent, inputValue, sellToken.decimals, isEditing]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const num = Number(value);
    const validDecimalOrInteger = /^\d*\.?\d{0,2}$/.test(value) || /^\d+$/.test(value);

    const isValidInput = !Number.isNaN(num) && num >= 0 && validDecimalOrInteger;

    if (isValidInput) {
      setInputValue(value);
    }
  };

  const commitInputValue = (e: React.FormEvent) => {
    e.preventDefault();

    const num = Number(inputValue);

    if (!Number.isNaN(num) && num >= 0) {
      setSlippageBps(num > 0 ? num * 100 : 100);
    }

    setIsEditing(false);
  };

  // auto focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div className={`flex items-center gap-4 cursor-pointer ${isEditing ? "" : "underline"}`}>
      {isEditing ? (
        <form className="flex items-center gap-4 cursor-default" onSubmit={commitInputValue}>
          <div className="flex items-center gap-0">
            <input
              ref={inputRef}
              className={`w-[3ch] text-right monospace cursor-pointer outline-none ${inputValue !== "" ? "text-primary" : "text-tertiary"}`}
              size={inputValue === "" ? 1 : inputValue.length}
              type="text"
              name="slippageBps"
              id="slippageBps"
              value={inputValue}
              onChange={handleInput}
            />
            <span
              className={`ml-[0.25ch] monospace ${inputValue !== "" ? "text-primary" : "text-tertiary"}`}
            >
              %
            </span>
          </div>
          <span
            className={`monospace text-[12px] select-none ${inputValue !== "" ? "text-primary" : "text-tertiary"}`}
          >
            ({slippageTokenValue} {sellToken.symbol})
          </span>
          <button
            className="h-8 w-8 flex items-center justify-center cursor-pointer rounded-xs hover:bg-border active:bg-tertiary"
            type="submit"
          >
            <Check className="fill-primary" title="✓" />
          </button>
          <button
            className="h-8 w-8 flex items-center justify-center cursor-pointer rounded-xs hover:bg-border active:bg-tertiary"
            type="button"
            onClick={() => setIsEditing(false)}
          >
            <Close className="fill-primary" title="ｘ" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="monospace text-[12px] text-primary cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          {slippagePercent}% ({slippageTokenValue} {sellToken.symbol})
        </button>
      )}
    </div>
  );
}
