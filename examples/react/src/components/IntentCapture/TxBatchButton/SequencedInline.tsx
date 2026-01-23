import { useCallback, useState } from "react";
import { useSendTransaction } from "wagmi";
import { Loading } from "@/components/icons/Loading";
import { toast } from "@/components/Toast";
import { getExplorerLink } from "@/config/onchain";
import { structureError } from "@/utils/errors";
import type { TxBatchButtonProps } from ".";
import { TriggerWalletButton } from "./TriggerWalletButton";

export function SequencedInlineTxBatchButton({ calls, blocked, onComplete }: TxBatchButtonProps) {
  const [state, setState] = useState<"idle" | "processing">("idle");
  const [step, setStep] = useState(0);

  const sendTransaction = useSendTransaction();

  const executeStep = useCallback(async () => {
    setState("processing");

    const initialToast = toast("Confirm in wallet...", {
      icon: <Loading className="fill-surface-base" />,
    });

    try {
      const hash = await sendTransaction.mutateAsync(calls[step]);

      initialToast.dismiss();

      toast("Tx Submitted", {
        link: getExplorerLink(calls[step].chainId, "tx", hash),
      });

      if (step === calls.length - 1 && onComplete) {
        if (calls[step]) {
          onComplete(hash);
        }
        setStep(0);
      }
    } catch (e) {
      console.error("Error executing route:", e);
      toast(structureError(e).title);
    } finally {
      setState("idle");
    }
  }, [calls, sendTransaction, step, onComplete]);

  return (
    <TriggerWalletButton
      disabled={blocked || state === "processing"}
      processing={state === "processing"}
      onClick={executeStep}
    />
  );
}
