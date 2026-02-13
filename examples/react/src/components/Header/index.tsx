import { Link } from "@tanstack/react-router";
import { type JSX, useCallback, useEffect, useState } from "react";
import { useConnection, useDisconnect } from "wagmi";
import { useSupportedChain } from "@/hooks/useSupportedChain";
import { useConnectWallet } from "@/providers/ConnectWalletProvider";
import { formatAddress } from "@/utils/strings";
import { Button } from "../Button";
import { ThemePicker } from "../ThemePicker";
import { TokenDrawer } from "../TokenDrawer";
import { Tooltip } from "../Tooltip";
import { Logo } from "./Logo";

function ConnectButton() {
  const { address, isConnected } = useConnection();
  const { isSupportedChain, ensureChain } = useSupportedChain();
  const { openConnectDialog } = useConnectWallet();
  const disconnect = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, []);

  const handleDisconnect = useCallback(async () => {
    await disconnect.mutateAsync();
  }, [disconnect]);

  if (!mounted) return null;

  let content: JSX.Element | null = null;

  if (!isConnected) {
    content = (
      <Button variant="primary" onClick={openConnectDialog}>
        Connect Wallet
      </Button>
    );
  } else if (isConnected && address) {
    content = (
      <>
        <Tooltip
          trigger={
            <button
              type="button"
              onClick={!isSupportedChain ? () => ensureChain() : undefined}
              className={`rounded-[2px_0px_0px_2px] h-20 w-20 relative border border-primary border-r-0 ${!isSupportedChain ? "grayscale cursor-pointer hover:grayscale-0" : ""} transition-grayscale duration-425`}
            >
              <div className="h-10 w-10 absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2">
                <img src={`/images/8453@2x.png`} alt="Base" />
              </div>
            </button>
          }
          content={!isSupportedChain ? "Click to switch to Base" : "Base"}
          dark
        />

        <Tooltip
          trigger={
            <Button
              variant="secondary"
              onClick={handleDisconnect}
              className="rounded-[0px_2px_2px_0px] h-20 px-6"
            >
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
            </Button>
          }
          content="Disconnect"
          dark
        />
      </>
    );
  }

  return <div className="flex monospace">{content}</div>;
}

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 0);
    }

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed top-0 left-10 right-10 sm:left-0 sm:right-0 z-layer-navigation bg-surface-base">
      <div
        className={`relative max-w-360 mx-auto border-b border-primary ${isScrolled ? "py-10" : "py-20"} transition-[padding]`}
      >
        <div className="flex items-center justify-between gap-8">
          <Link to="/" aria-label="Home">
            <Logo />
          </Link>
          <ConnectButton />
        </div>

        <TokenDrawer />
      </div>

      <ThemePicker />
    </nav>
  );
}
