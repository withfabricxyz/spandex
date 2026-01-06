import type { Address } from "viem";
import { MarketNetwork } from "@/components/icons/MarketNetwork";
import { useNoScroll } from "@/hooks/useNoScroll";
import type { TokenMetadata } from "@/services/tokens";

export function SuccessSplash({
  // sellToken,
  // buyToken,
  // account,
  onClose,
}: {
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  account: Address;
  onClose: () => void;
}) {
  useNoScroll(true);

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-307 bg-black text-primary z-layer-dialog p-20">
      <div className="h-dvh flex flex-col items-center justify-center gap-40 text-white text-center">
        <span className="uppercase text-[28px] leading-12">Success</span>
        <MarketNetwork className="fill-disabled" />
        <span className="text-[20px]">
          <span className="inline-block">Route swaps to the highest performing provider.</span>
          <span className="inline-block">Get started with a free API key.</span>
        </span>
        <div className="flex flex-col gap-4 w-full">
          <button
            type="button"
            className="w-full h-20 bg-black text-primary py-4 px-8 text-center monospace text-[12px] cursor-pointer"
            onClick={onClose}
          >
            Done
          </button>
          <a
            href="docs.withfabric.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-20 bg-white text-surface-base py-4 px-8 text-center monospace text-[12px] cursor-pointer"
          >
            Get Started
          </a>
        </div>
      </div>
    </div>
  );
}
