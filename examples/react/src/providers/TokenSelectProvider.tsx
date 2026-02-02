import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SUPPORTED_BASE_TOKENS } from "@/constants/tokens";
import type { TokenMetadata } from "@/services/tokens";

type TokenSelectContextValues = {
  selectContext: "sell" | "buy";
  sellToken: TokenMetadata;
  setSellToken: (token: TokenMetadata) => void;
  buyToken: TokenMetadata;
  setBuyToken: (token: TokenMetadata) => void;
  isDrawerOpen: boolean;
  openDrawer: (context: "sell" | "buy") => void;
  closeDrawer: () => void;
  activePercent: BalancePercent;
  setActivePercent: (percent: BalancePercent) => void;
  onSuccessfulTx: () => void;
};

export type BalancePercent = "0%" | "25%" | "50%" | "max";

const TokenSelectContext = createContext<TokenSelectContextValues>({} as TokenSelectContextValues);

export function useTokenSelect() {
  return useContext(TokenSelectContext);
}

export function TokenSelectProvider({ children }: React.PropsWithChildren) {
  const [sellToken, setSellToken] = useState<TokenMetadata>(
    // biome-ignore lint/style/noNonNullAssertion: <>
    SUPPORTED_BASE_TOKENS.find((t) => t.symbol === "USDC")!,
  );
  const [buyToken, setBuyToken] = useState<TokenMetadata>(
    // biome-ignore lint/style/noNonNullAssertion: <>
    SUPPORTED_BASE_TOKENS.find((t) => t.symbol === "WETH")!,
  );

  const [activePercent, setActivePercent] = useState<BalancePercent>("25%");

  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    context: "sell" | "buy";
  }>({ isOpen: false, context: "sell" });

  const openDrawer = useCallback((context: "sell" | "buy") => {
    setDrawerState({ isOpen: true, context });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const onSuccessfulTx = useCallback(() => {
    setActivePercent("25%");
  }, []);

  const value = useMemo(
    () => ({
      selectContext: drawerState.context,
      isDrawerOpen: drawerState.isOpen,
      openDrawer,
      closeDrawer,
      sellToken,
      setSellToken,
      buyToken,
      setBuyToken,
      activePercent,
      setActivePercent,
      onSuccessfulTx,
    }),
    [
      drawerState.context,
      drawerState.isOpen,
      openDrawer,
      closeDrawer,
      sellToken,
      buyToken,
      activePercent,
      onSuccessfulTx,
    ],
  );

  return <TokenSelectContext.Provider value={value}>{children}</TokenSelectContext.Provider>;
}
