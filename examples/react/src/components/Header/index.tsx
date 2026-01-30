import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Connector, useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";
import { formatAddress } from "../../utils/strings";
import { Button } from "../Button";
import { Dialog } from "../Dialog";
import { ThemePicker } from "../ThemePicker";
import { TokenDrawer } from "../TokenDrawer";
import { Tooltip } from "../Tooltip";
import { Logo } from "./Logo";

function WalletOptions({ onConnected }: { onConnected: () => void }) {
  const connect = useConnect();
  const connectors = useConnectors();

  const injectedConnectors = useMemo(() => {
    let injected = connectors.filter((c) => c.type === "injected");
    if (injected.length > 1) {
      // Remove generic injected if we have MetaMask
      injected = injected.filter((c) => c.id !== "injected");
    }

    return injected;
  }, [connectors]);

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
        {connectorIcon(connector)}
        <span>{connector.name}</span>
      </div>
    </button>
  ));
}

const icons: Record<string, string> = {
  coinbaseWalletSDK: "https://www.coinbase.com/assets/sw-cache/a_DVA0h2KN.png",
  walletConnect:
    "https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/refs/heads/master/Icon/White/Icon.svg",
  safe: "https://logosandtypes.com/wp-content/uploads/2024/02/safe.svg",
};

function connectorIcon(connector: Connector) {
  let url = "/icons/question_mark.svg";

  if (icons[connector.id] !== undefined) {
    url = icons[connector.id];
  }

  if (connector.icon) {
    url = connector.icon;
  }

  return <img src={url} alt={connector.name} className="h-24 w-24" />;
}

export function Header() {
  const { address, isConnected, chainId } = useConnection();
  const disconnect = useDisconnect();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    // quiet the hydration warning; address not available on first render
    setMounted(true);

    function onScroll() {
      setIsScrolled(window.scrollY > 0);
    }

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleDisconnect = useCallback(async () => {
    await disconnect.mutateAsync();
  }, [disconnect]);

  return (
    <nav className="fixed top-0 left-10 right-10 sm:left-0 sm:right-0 z-layer-navigation bg-surface-base">
      <div
        className={`relative max-w-360 mx-auto border-b border-primary ${isScrolled ? "py-10" : "py-20"} transition-[padding]`}
      >
        <div className="flex items-center justify-between gap-8">
          <Link to="/" aria-label="Home">
            <Logo />
          </Link>
          <div className="flex">
            {isConnected ? (
              <Tooltip
                trigger={
                  <div className="rounded-[2px_0px_0px_2px] h-20 w-20 relative border border-primary border-r-0">
                    <div className="h-10 w-10 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2">
                      <img src={`/images/${chainId}@2x.png`} alt={`Chain ${chainId}`} />
                    </div>
                  </div>
                }
                content="Base"
              />
            ) : null}
            <Button
              variant={isConnected ? "secondary" : "primary"}
              className={isConnected ? "rounded-[0_2px_2px_0px]" : undefined}
              onClick={() => {
                if (!isConnected) return setIsModalOpen(true);
                handleDisconnect();
              }}
            >
              <div className="monospace">
                {mounted && address ? (
                  <div className="flex items-center justify-between gap-4">
                    <span>{formatAddress(address)}</span>
                    <div className="h-16 w-16 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="13"
                        height="13"
                        viewBox="0 0 13 13"
                        fill="none"
                      >
                        <title>Disconnect</title>
                        <path
                          d="M1.44444 13C1.04722 13 0.707176 12.8586 0.424306 12.5757C0.141435 12.2928 0 11.9528 0 11.5556V1.44444C0 1.04722 0.141435 0.707176 0.424306 0.424306C0.707176 0.141435 1.04722 0 1.44444 0H6.5V1.44444H1.44444V11.5556H6.5V13H1.44444ZM9.38889 10.1111L8.39583 9.06389L10.2375 7.22222H4.33333V5.77778H10.2375L8.39583 3.93611L9.38889 2.88889L13 6.5L9.38889 10.1111Z"
                          fill="var(--color-primary)"
                        />
                      </svg>
                    </div>
                  </div>
                ) : (
                  "Connect Wallet"
                )}
              </div>
            </Button>
          </div>
        </div>

        <TokenDrawer />
      </div>

      <Dialog
        title="Connect Your Wallet"
        isOpen={isModalOpen && !isConnected}
        onClose={() => {
          setIsModalOpen(false);
        }}
      >
        <div className="flex flex-col gap-12">
          <WalletOptions
            onConnected={() => {
              setIsModalOpen(false);
            }}
          />
        </div>
      </Dialog>

      <ThemePicker />
    </nav>
  );
}
