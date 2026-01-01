import { useEffect, useMemo, useRef, useState } from "react";
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
    const amount = BigInt((Number(numSellTokens) / 100) * Number(base) * 10 ** sellToken.decimals);

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
            className={`font-['Sohne_Mono'] text-[12px] select-none ${inputValue !== "" ? "text-primary" : "text-tertiary"}`}
          >
            ({slippageTokenValue} {sellToken.symbol})
          </span>
          <button
            className="h-8 w-8 flex items-center justify-center cursor-pointer rounded-xs hover:bg-border active:bg-tertiary"
            type="submit"
          >
            <svg
              className="fill-primary"
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="9"
              viewBox="0 0 11 9"
              fill="none"
            >
              <title>✓</title>
              <path d="M3.8 8.01667L0 4.21667L0.95 3.26667L3.8 6.11667L9.91667 0L10.8667 0.95L3.8 8.01667Z" />
            </svg>
          </button>
          <button
            className="h-8 w-8 flex items-center justify-center cursor-pointer rounded-xs hover:bg-border active:bg-tertiary"
            type="button"
            onClick={() => setIsEditing(false)}
          >
            <svg
              className="fill-primary"
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
            >
              <title>ｘ</title>
              <path d="M0.933334 9.33334L0 8.4L3.73333 4.66667L0 0.933334L0.933334 0L4.66667 3.73333L8.4 0L9.33334 0.933334L5.6 4.66667L9.33334 8.4L8.4 9.33334L4.66667 5.6L0.933334 9.33334Z" />
            </svg>
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="font-['Sohne_Mono'] text-[12px] text-primary cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          {slippagePercent}% ({slippageTokenValue} {sellToken.symbol})
        </button>
      )}
    </div>
  );
}
