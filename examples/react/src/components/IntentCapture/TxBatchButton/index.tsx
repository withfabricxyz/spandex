import type { Address, Hex } from "viem";
// import { useConnection } from "wagmi";
import { useWalletProperties } from "@/hooks/useWalletProperties";
// import { ConnectButton } from "../ConnectButton";
import { SequencedInlineTxBatchButton } from "./SequencedInline";
import { SequencedWalletTxBatchButton } from "./SequencedWallet";
import { WalletDeferredTxBatchButton } from "./WalletDeferred";

export type TxData = {
  name: string;
  data: Hex;
  to: Address;
  value?: bigint;
  chainId: number;
  afterSubmit?: () => Promise<void>; // Optional callback after submission
};

export type TxBatchButtonProps = {
  variant: "buy" | "sell";
  blocked: boolean;
  calls: TxData[];
  onComplete?: () => void; // Optional callback when all transactions are completed
};

export function TxBatchButton(props: TxBatchButtonProps) {
  // const { isConnected } = useConnection();
  const walletProps = useWalletProperties({ chainId: props.calls[0].chainId });

  // if (!isConnected) {
  //   return <ConnectButton />;
  // }

  if (walletProps.batching) {
    return <WalletDeferredTxBatchButton {...props} />;
  }

  if (walletProps.injected) {
    return <SequencedWalletTxBatchButton {...props} />;
  }

  return <SequencedInlineTxBatchButton {...props} />;
}
