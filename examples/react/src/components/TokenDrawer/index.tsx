import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { erc20Abi } from "viem";
import { useReadContracts } from "wagmi";
import { TokenItem } from "@/components/TokenItem";
import { SUPPORTED_BASE_TOKENS } from "@/constants/tokens";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import styles from "./TokenDrawer.module.css";

function IconX() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <title>X</title>
      <path
        d="M1.2 12L0 10.8L4.8 6L0 1.2L1.2 0L6 4.8L10.8 0L12 1.2L7.2 6L12 10.8L10.8 12L6 7.2L1.2 12Z"
        fill="#0F0F0F"
      />
    </svg>
  );
}

function IconLoading() {
  return (
    <div className="transform animate-spin">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 17 17"
        fill="none"
      >
        <title>loading</title>
        <path
          d="M0 8.33333C-1.35811e-08 9.47222 0.21875 10.5486 0.65625 11.5625C1.09375 12.5764 1.69097 13.4618 2.44792 14.2187C3.20486 14.9757 4.09028 15.5729 5.10417 16.0104C6.11805 16.4479 7.19444 16.6667 8.33333 16.6667C9.48611 16.6667 10.566 16.4479 11.5729 16.0104C12.5799 15.5729 13.4618 14.9757 14.2187 14.2187C14.9757 13.4618 15.5729 12.5764 16.0104 11.5625C16.4479 10.5486 16.6667 9.47222 16.6667 8.33333H15C15 10.1806 14.3507 11.7535 13.0521 13.0521C11.7535 14.3507 10.1806 15 8.33333 15C6.48611 15 4.91319 14.3507 3.61458 13.0521C2.31597 11.7535 1.66667 10.1806 1.66667 8.33333C1.66667 6.48611 2.31597 4.91319 3.61458 3.61458C4.91319 2.31597 6.48611 1.66667 8.33333 1.66667V0C7.19444 -1.35811e-08 6.11805 0.21875 5.10417 0.65625C4.09028 1.09375 3.20486 1.69097 2.44792 2.44792C1.69097 3.20486 1.09375 4.0868 0.65625 5.09375C0.21875 6.10069 1.37467e-08 7.18055 0 8.33333Z"
          fill="var(--color-primary)"
        />
      </svg>
    </div>
  );
}

function ContractAddressInput() {
  const { selectContext, setSellToken, setBuyToken, closeDrawer } = useTokenSelect();
  const [inputValue, setInputValue] = useState("");
  const processedRef = useRef<string | null>(null);

  const inputValid = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(inputValue), [inputValue]);

  const { data, error, isLoading } = useReadContracts({
    contracts: [
      {
        address: inputValue as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol",
      },
      {
        address: inputValue as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      },
    ],
    query: {
      enabled: inputValid,
    },
  });

  // once we have the token, set it in context and close the drawer
  useEffect(() => {
    if (!inputValid || !data || processedRef.current === inputValue || !!error) return;

    const [symbolResult, decimalsResult] = data;

    if (!symbolResult?.result || !decimalsResult?.result) return;

    const token = {
      address: inputValue,
      symbol: symbolResult.result,
      decimals: decimalsResult.result,
    } as TokenMetadata;

    selectContext === "sell" ? setSellToken(token) : setBuyToken(token);

    // don't re-run the effect, we're ready to close the drawer and proceed. prevents a render loop
    processedRef.current = inputValue;

    setInputValue("");
    closeDrawer();

    return () => {
      // clear on unmount; refs persist
      processedRef.current = null;
    };
  }, [inputValue, inputValid, data, error, selectContext, setSellToken, setBuyToken, closeDrawer]);

  return (
    <div className={`${styles.tokenDrawerInput} px-20 mb-20 relative`}>
      <input
        type="text"
        className="h-20 font-['Sohne_Breit'] w-full border rounded-xs p-4 focus:outline-0 active:outline-0 placeholder:text-[#b3b3b3]"
        value={inputValue}
        onChange={({ target }) => setInputValue(target.value)}
        placeholder="Contract address"
      />
      <button
        type="button"
        className="h-16 w-16 flex items-center absolute top-1/2 right-22 -translate-y-1/2 justify-center cursor-pointer"
        onClick={closeDrawer}
        onKeyDown={closeDrawer}
      >
        {isLoading ? <IconLoading /> : <IconX />}
      </button>
    </div>
  );
}

export function TokenDrawer() {
  const { selectContext, setSellToken, setBuyToken, isDrawerOpen, closeDrawer } = useTokenSelect();
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closeDrawer();
      }
    },
    [closeDrawer],
  );

  useEffect(() => {
    if (!ref.current) return;

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleClickOutside]);

  return (
    <div className={`${styles.tokenDrawer} ${isDrawerOpen ? styles.open : ""}`} ref={ref}>
      <ContractAddressInput />
      <div className={styles.tokenDrawerContent}>
        <div className={styles.tokenDrawerList}>
          {SUPPORTED_BASE_TOKENS.map((token) => (
            <TokenItem
              key={token.address}
              token={token}
              onClick={(token) => {
                if (selectContext === "sell") {
                  setSellToken(token);
                } else {
                  setBuyToken(token);
                }
                closeDrawer();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
