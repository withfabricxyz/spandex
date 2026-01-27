import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { erc20Abi } from "viem";
import { useReadContracts } from "wagmi";
import { CloseAlt, Loading } from "@/components/icons";
import { TokenItem } from "@/components/TokenItem";
import { SUPPORTED_BASE_TOKENS } from "@/constants/tokens";
import { useNoScroll } from "@/hooks/useNoScroll";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import styles from "./TokenDrawer.module.css";

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
        className="h-20 w-full text-primary border border-primary rounded-xs p-4 focus:outline-0 active:outline-0 placeholder:text-primary"
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
        {isLoading ? <Loading title="loading" /> : <CloseAlt title="X" />}
      </button>
    </div>
  );
}

export function TokenDrawer() {
  const { selectContext, setSellToken, setBuyToken, isDrawerOpen, closeDrawer } = useTokenSelect();
  const ref = useRef<HTMLDivElement>(null);

  useNoScroll(isDrawerOpen);

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
