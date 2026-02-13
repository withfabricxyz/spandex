import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Connector, useConnect, useConnection, useConnectors } from "wagmi";
import { Dialog } from "@/components/Dialog";

type ConnectWalletContextValues = {
  openConnectDialog: () => void;
};

const ConnectWalletContext = createContext<ConnectWalletContextValues>(
  {} as ConnectWalletContextValues,
);

export function useConnectWallet() {
  return useContext(ConnectWalletContext);
}

const connectorIcons: Record<string, string> = {
  coinbaseWalletSDK: "https://www.coinbase.com/assets/sw-cache/a_DVA0h2KN.png",
  walletConnect:
    "https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/refs/heads/master/Icon/White/Icon.svg",
  safe: "https://logosandtypes.com/wp-content/uploads/2024/02/safe.svg",
};

function getConnectorIcon(connector: Connector) {
  let url = "/icons/question_mark.svg";
  if (connectorIcons[connector.id] !== undefined) {
    url = connectorIcons[connector.id];
  }
  if (connector.icon) {
    url = connector.icon;
  }
  return <img src={url} alt={connector.name} className="h-24 w-24" />;
}

function WalletOptions({ onConnected }: { onConnected: () => void }) {
  const connect = useConnect();
  const connectors = useConnectors();
  const injectedEthereum = (window as Window & { ethereum?: unknown }).ethereum;

  const injectedConnectors = useMemo(() => {
    let injected = connectors.filter((c) => c.type === "injected");
    if (injected.length > 1) {
      injected = injected.filter((c) => c.id !== "injected");
    }
    return injected;
  }, [connectors]);

  if (typeof window === "undefined") {
    return null;
  }

  if (!injectedEthereum) {
    return <span className="text-center text-secondary">Must have an injected wallet</span>;
  }

  return injectedConnectors.map((connector) => (
    <button
      key={connector.uid}
      onClick={async () => {
        await connect.mutateAsync({ connector });
        onConnected();
      }}
      type="button"
      className="cursor-pointer px-8 py-4 hover:bg-surface-low rounded-8"
    >
      <div className="flex items-center gap-8">
        {getConnectorIcon(connector)}
        <span>{connector.name}</span>
      </div>
    </button>
  ));
}

export function ConnectWalletProvider({ children }: React.PropsWithChildren) {
  const { isConnected } = useConnection();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setIsOpen(false);
    }
  }, [isConnected]);

  const openConnectDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const value = useMemo(() => ({ openConnectDialog }), [openConnectDialog]);

  return (
    <ConnectWalletContext.Provider value={value}>
      {children}
      <Dialog
        title="Connect Your Wallet"
        isOpen={isOpen && !isConnected}
        onClose={() => setIsOpen(false)}
      >
        <div className="flex flex-col gap-12">
          <WalletOptions onConnected={() => setIsOpen(false)} />
        </div>
      </Dialog>
    </ConnectWalletContext.Provider>
  );
}
