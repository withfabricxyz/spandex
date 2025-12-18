import { useCallback, useState } from "react";
import { useSendTransaction } from "wagmi";
// import { toast } from "~/components/library/Toast";
// import { getExplorerLink } from "~/config/onchain";
import { type StructuredError, structureError } from "@/utils/errors";
import type { TxBatchButtonProps } from ".";
import { TriggerWalletButton } from "./TriggerWalletButton";

export function SequencedInlineTxBatchButton({
  variant,
  calls,
  blocked,
  onComplete,
}: TxBatchButtonProps) {
  const [error, setError] = useState<StructuredError | undefined>(undefined);
  const [state, setState] = useState<"idle" | "processing">("idle");
  const [step, setStep] = useState(0);

  const { sendTransactionAsync } = useSendTransaction();

  const executeStep = useCallback(async () => {
    setError(undefined);
    setState("processing");

    try {
      const hash = await sendTransactionAsync(calls[step]);
      console.log("Transaction submitted with hash:", hash);
      // toast("Tx Submitted", {
      //   link: getExplorerLink(calls[step].chainId, "tx", hash),
      // });

      if (step === calls.length - 1) {
        if (calls[step]) {
          await onComplete?.();
        }
        setStep(0);
      }
    } catch (e) {
      console.error("Error executing route:", e);
      setError(structureError(e));
    } finally {
      setState("idle");
    }
  }, [calls, sendTransactionAsync, step, onComplete]);

  return (
    <TriggerWalletButton
      variant={variant}
      disabled={blocked || state === "processing"}
      processing={state === "processing"}
      error={error}
      onClick={executeStep}
    />
  );
}
