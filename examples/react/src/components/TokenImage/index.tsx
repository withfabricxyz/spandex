import { useConnection } from "wagmi";
import type { TokenMetadata } from "@/services/tokens";

export function TokenImage({ token, size = "md" }: { token: TokenMetadata; size?: "sm" | "md" }) {
  const { chainId } = useConnection();
  const chainImage = chainId ? `/images/${chainId}@2x.png` : undefined;

  return (
    <div className={`${size === "sm" ? "h-12 w-12" : "h-16 w-16"} rounded-full relative`}>
      <img
        src={token.logoURI}
        alt={token.symbol}
        className={`${size === "sm" ? "h-12 w-12" : "h-16 w-16"} rounded-full`}
      />
      {chainImage && (
        <img
          src={chainImage}
          alt="chain"
          className={`absolute bottom-0 right-0 ${size === "sm" ? "h-5 w-5" : "h-6 w-6"} rounded-xs border border-surface-base bg-surface-base`}
        />
      )}
    </div>
  );
}
