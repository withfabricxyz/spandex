import type { TokenMetadata } from "../../services/tokens";
import { formatAddress } from "../../utils/strings";
import styles from "./TokenItem.module.css";

type TokenItemProps = {
  token: TokenMetadata;
};

export function TokenItem({ token }: TokenItemProps) {
  return (
    <div className={styles.tokenItem}>
      <div className="flex justify-between py-10 px-20">
        <div className="flex gap-6">
          <div className="coinImage h-16 w-16 rounded-full relative overflow-hidden">
            <img src={token.logoURI} alt={token.symbol} className="h-16 w-16 rounded-full" />
          </div>
          <div className="tokenMeta flex flex-col gap-4">
            <div className="tokenSymbol text-[20px] leading-10 font-['Sohne_Breit']">
              {token.symbol}
            </div>
            <div className="tokenName text-[11px] text-secondary-1 leading-[11px] font-['Sohne_Mono']">
              {formatAddress(token.address)}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="tokenBalance">{(token.usdPriceCents / 100).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
