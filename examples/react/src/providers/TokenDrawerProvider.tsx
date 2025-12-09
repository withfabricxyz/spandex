import { createContext, useContext, useMemo, useState } from "react";

type TokenDrawerContextValues = {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (isOpen: boolean) => void;
};

const TokenDrawerContext = createContext<TokenDrawerContextValues>({} as TokenDrawerContextValues);

export function useTokenDrawer() {
  return useContext(TokenDrawerContext);
}

export function TokenDrawerProvider({ children }: React.PropsWithChildren) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const value = useMemo(
    () => ({
      isDrawerOpen,
      setIsDrawerOpen,
    }),
    [isDrawerOpen],
  );

  return <TokenDrawerContext.Provider value={value}>{children}</TokenDrawerContext.Provider>;
}
