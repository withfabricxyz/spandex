import { useCallback, useEffect, useRef } from "react";
import { useTokenSelect } from "@/providers/TokenSelectProvider";
import { SUPPORTED_BASE_TOKENS } from "../../constants/tokens";
import { TokenItem } from "../TokenItem";
import styles from "./TokenDrawer.module.css";

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
      <div className={`${styles.tokenDrawerInput} px-20 mb-20 relative`}>
        <input
          type="text"
          className="h-20 font-['Sohne_Breit'] w-full border rounded-xs p-4 focus:outline-0 active:outline-0 placeholder:text-[#b3b3b3]"
          placeholder="Contract address"
        />
        {/** biome-ignore lint/a11y/noStaticElementInteractions: <> */}
        <div
          className="h-16 w-16 flex items-center absolute top-1/2 right-22 -translate-y-1/2 justify-center cursor-pointer"
          onClick={closeDrawer}
          onKeyDown={closeDrawer}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <title>X</title>
            <path
              d="M1.2 12L0 10.8L4.8 6L0 1.2L1.2 0L6 4.8L10.8 0L12 1.2L7.2 6L12 10.8L10.8 12L6 7.2L1.2 12Z"
              fill="#0F0F0F"
            />
          </svg>
        </div>
      </div>
      <div className={styles.tokenDrawerContent}>
        <div className={styles.tokenDrawerList}>
          {SUPPORTED_BASE_TOKENS.map((token) => (
            <TokenItem key={token.address} token={token} onClick={(token) => {
              if (selectContext === "sell") {
                setSellToken(token);
              } else {
                setBuyToken(token);
              }
              closeDrawer();
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
