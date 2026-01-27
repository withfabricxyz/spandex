import { useWalletProperties } from "@/hooks/useWalletProperties";
import type { SwapErrorState } from "@/utils/errors";
import type { TxData } from "../index";
import { SequencedInlineTxBatchButton } from "./SequencedInline";
import { SequencedWalletTxBatchButton } from "./SequencedWallet";
import { WalletDeferredTxBatchButton } from "./WalletDeferred";

export type TxBatchButtonProps = {
  blocked: boolean;
  calls: TxData[];
  onComplete?: (hash: `0x${string}`) => void;
  onError?: (error: unknown) => void;
  errors?: SwapErrorState;
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
