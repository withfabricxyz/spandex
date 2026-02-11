import { useCallback, useState } from "react";
import { useSendTransaction } from "wagmi";
import { toast } from "@/components/Toast";
import { getExplorerLink } from "@/config/onchain";
import type { TxBatchButtonProps } from ".";
import { TriggerWalletButton } from "./TriggerWalletButton";

export function SequencedInlineTxBatchButton({
  calls,
  blocked,
  errors,
  isFetchingQuotes,
  onComplete,
  onError,
}: TxBatchButtonProps) {
  const [state, setState] = useState<"idle" | "processing">("idle");
  const [step, setStep] = useState(0);

  const sendTransaction = useSendTransaction();

  const executeStep = useCallback(async () => {
    setState("processing");

    try {
      const hash = await sendTransaction.mutateAsync(calls[step]);

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
      onError?.(e);
    } finally {
      setState("idle");
    }
  }, [calls, sendTransaction, step, onComplete, onError]);

  return (
    <TriggerWalletButton
      disabled={blocked || state === "processing"}
      processing={state === "processing"}
      isFetchingQuotes={isFetchingQuotes}
      errors={errors}
      onClick={executeStep}
    />
  );
}
