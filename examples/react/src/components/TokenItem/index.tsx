import type { TokenMetadata } from "../../services/tokens";
import { formatAddress } from "../../utils/strings";
import { TokenImage } from "../TokenImage";
import styles from "./TokenItem.module.css";

type TokenItemProps = {
  token: TokenMetadata;
  onClick: (token: TokenMetadata) => void;
};

export function TokenItem({ token, onClick }: TokenItemProps) {
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
          <div className="tokenBalance text-primary">{(token.usdPriceCents / 100).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
