import { call as wagmiCall } from "@wagmi/core";
import { useCallback, useState } from "react";
import { useConfig, useConnection, useSendTransaction } from "wagmi";
import { Loading } from "@/components/icons";
import { toast } from "@/components/Toast";
import { getExplorerLink } from "@/config/onchain";
import { structureError } from "@/utils/errors";
import type { TxBatchButtonProps } from ".";
import { TriggerWalletButton } from "./TriggerWalletButton";

const dwellTime = 2500;

export function SequencedWalletTxBatchButton({ calls, blocked, onComplete }: TxBatchButtonProps) {
  const [state, setState] = useState<"idle" | "processing">("idle");

  const { address } = useConnection();
  const config = useConfig();
  const sendTransaction = useSendTransaction();

  const executeStep = useCallback(async () => {
    setState("processing");

    const initialToast = toast("Confirm in wallet...", {
      icon: <Loading className="fill-surface-base" />,
    });

    try {
      for (const call of calls) {
        // Simulate the call before sending the transaction
        await wagmiCall(config, {
          account: address,
          data: call.data,
          to: call.to,
        });

        const hash = await sendTransaction.mutateAsync({
          data: call.data,
          to: call.to,
          value: call.value,
          chainId: call.chainId,
        });

        initialToast.dismiss();

        toast(`${call.name} Tx Submitted`, {
          link: getExplorerLink(call.chainId, "tx", hash),
        });

        await new Promise((resolve) => setTimeout(resolve, dwellTime)); // Wait for dwell time before next transaction

        if (calls.indexOf(call) === calls.length - 1 && onComplete) {
          onComplete(hash);
        }
      }
    } catch (e) {
      console.error("Error executing route:", e);
      initialToast.dismiss();
      toast(structureError(e).title);
    } finally {
      setState("idle");
    }
  }, [calls, sendTransaction, onComplete, config, address]);

  return (
    <TriggerWalletButton
      disabled={blocked || state === "processing"}
      processing={state === "processing"}
      onClick={executeStep}
    />
  );
}
