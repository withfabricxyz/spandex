import { useCallback, useState } from "react";
import { useSendCalls } from "wagmi";
// import { toast } from "~/components/library/Toast";
import { type StructuredError, structureError } from "@/utils/errors";
import { noOxfordComma } from "@/utils/strings";
import type { TxBatchButtonProps } from ".";
import { TriggerWalletButton } from "./TriggerWalletButton";

// EIP-5792 UX Buff - https://github.com/ethereum/EIPs/blob/815028dc634463e1716fc5ce44c019a6040f0bef/EIPS/eip-5792.md#wallet_sendcalls
export function WalletDeferredTxBatchButton({
  variant,
  calls,
  blocked,
  onComplete,
}: TxBatchButtonProps) {
  const [error, setError] = useState<StructuredError | undefined>(undefined);
  const [state, setState] = useState<"idle" | "processing">("idle");

  const { sendCallsAsync } = useSendCalls();

  const executeStep = useCallback(async () => {
    setError(undefined);
    setState("processing");

    try {
      // TODO: Inject capaibilites if we want to use paymasters
      const hash = await sendCallsAsync({ calls });

      // TODO: useCallStatus? there is a specialized hook for this
      console.log("Transaction batch submitted", hash);
      // toast("Tx Batch Submitted");
      if (onComplete) {
        await onComplete();
      }
    } catch (e) {
      console.error("Error executing route:", e);
      setError(structureError(e));
    } finally {
      setState("idle");
    }
  }, [calls, sendCallsAsync, onComplete]);

  const text = noOxfordComma(calls.map((call) => call.name));

  return (
    <TriggerWalletButton
      variant={variant}
      text={text}
      disabled={blocked || state === "processing"}
      processing={state === "processing"}
      error={error}
      onClick={executeStep}
    />
  );
}
