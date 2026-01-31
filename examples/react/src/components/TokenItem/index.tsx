import type { Address } from "viem";
import { useConnection } from "wagmi";
import { useBalance } from "@/hooks/useBalance";
import type { TokenMetadata } from "../../services/tokens";
import { formatAddress, formatTokenValue } from "../../utils/strings";
import { TokenImage } from "../TokenImage";
import styles from "./TokenItem.module.css";

type TokenItemProps = {
  token: TokenMetadata;
  owner?: Address;
  onClick: (token: TokenMetadata) => void;
};

export function TokenItem({ token, owner, onClick }: TokenItemProps) {
  const { chainId } = useConnection();
  const { data: balance } = useBalance({
    chainId,
    owner,
    token: token.address,
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: <>
    // biome-ignore lint/a11y/useKeyWithClickEvents: <>
    <div className={styles.tokenItem} onClick={() => onClick(token)}>
      <div className="flex justify-between py-10 px-20">
        <div className="flex gap-6">
          <TokenImage token={token} />
          <div className="tokenMeta flex flex-col gap-4">
            <div className="tokenSymbol text-[20px] leading-10 text-primary">{token.symbol}</div>
            <div className="tokenName text-[11px] text-secondary leading-5.5 monospace">
              {formatAddress(token.address)}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="tokenBalance text-primary">
            {owner ? `${formatTokenValue(balance || 0n, token.decimals)} ${token.symbol}` : "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
}
