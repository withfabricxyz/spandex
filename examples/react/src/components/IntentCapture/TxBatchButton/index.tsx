import { useWalletProperties } from "@/hooks/useWalletProperties";
import type { TxData } from "../index";
import { SequencedInlineTxBatchButton } from "./SequencedInline";
import { SequencedWalletTxBatchButton } from "./SequencedWallet";
import { WalletDeferredTxBatchButton } from "./WalletDeferred";

export type TxBatchButtonProps = {
  blocked: boolean;
  calls: TxData[];
  onComplete?: (txHash: string) => void; // Optional callback when all transactions are completed
};

export function TxBatchButton(props: TxBatchButtonProps) {
  const chainId = props.calls[0]?.chainId;
  const walletProps = useWalletProperties({ chainId });

  if (walletProps.batching) {
    return <WalletDeferredTxBatchButton {...props} />;
  }

  if (walletProps.injected) {
    return <SequencedWalletTxBatchButton {...props} />;
  }

  return <SequencedInlineTxBatchButton {...props} />;
}
