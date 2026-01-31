import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { erc20Abi } from "viem";
import { useConnection, useReadContracts } from "wagmi";
import { CloseAlt, Loading } from "@/components/icons";
import { TokenItem } from "@/components/TokenItem";
import { SUPPORTED_BASE_TOKENS } from "@/constants/tokens";
import { useNoScroll } from "@/hooks/useNoScroll";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import type { TokenMetadata } from "@/services/tokens";
import styles from "./TokenDrawer.module.css";

const MIN_LOOKUP_DURATION_MS = 400;

function ContractAddressInput() {
  const { selectContext, setSellToken, setBuyToken, closeDrawer } = useTokenSelect();
  const [inputValue, setInputValue] = useState("");
  const [minDelayLoading, setMinDelayLoading] = useState(false);
  const processedRef = useRef<string | null>(null);
  const lookupStartTimeRef = useRef<number | null>(null);

  const inputValid = useMemo(() => {
    const isValid = /^0x[a-fA-F0-9]{40}$/.test(inputValue);
    if (isValid && lookupStartTimeRef.current === null) {
      lookupStartTimeRef.current = Date.now();
    } else if (!isValid) {
      lookupStartTimeRef.current = null;
    }
    return isValid;
  }, [inputValue]);

  const {
    data,
    error,
    isLoading: isTokenLoading,
  } = useReadContracts({
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

    // the lookup can execute "too quickly" on good internet - introduce an artificial delay
    // however, don't delay if the lookup takes longer than the minimum duration
    const elapsedTime = lookupStartTimeRef.current ? Date.now() - lookupStartTimeRef.current : 0;
    const remainingDelay = Math.max(0, MIN_LOOKUP_DURATION_MS - elapsedTime);

    if (remainingDelay > 0) {
      setMinDelayLoading(true);
      setTimeout(() => {
        setMinDelayLoading(false);
        setInputValue("");
        closeDrawer();
        lookupStartTimeRef.current = null;
      }, remainingDelay);
    } else {
      setInputValue("");
      closeDrawer();
      lookupStartTimeRef.current = null;
    }

    return () => {
      // clear on unmount; refs persist
      processedRef.current = null;
      lookupStartTimeRef.current = null;
    };
  }, [inputValue, inputValid, data, error, selectContext, setSellToken, setBuyToken, closeDrawer]);

  const isLoading = isTokenLoading || minDelayLoading;

  return (
    <div className="px-20 mb-20 relative">
      <input
        type="text"
        className={styles.tokenDrawerInput}
        value={inputValue}
        onChange={({ target }) => setInputValue(target.value)}
        placeholder="Contract address"
        disabled={isLoading}
      />
      <button
        type="button"
        className="h-16 w-16 flex items-center absolute top-1/2 right-22 -translate-y-1/2 justify-center cursor-pointer"
        onClick={closeDrawer}
        onKeyDown={closeDrawer}
      >
        {isLoading ? <Loading title="loading" className="fill-primary" /> : <CloseAlt title="X" />}
      </button>
    </div>
  );
}

export function TokenDrawer() {
  const { address } = useConnection();
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
              owner={address}
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
