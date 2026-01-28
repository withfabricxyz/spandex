import { useCallback, useState } from "react";
import { useSendCalls } from "wagmi";
import type { TxBatchButtonProps } from ".";
import { TriggerWalletButton } from "./TriggerWalletButton";

// EIP-5792 UX Buff - https://github.com/ethereum/EIPs/blob/815028dc634463e1716fc5ce44c019a6040f0bef/EIPS/eip-5792.md#wallet_sendcalls
export function WalletDeferredTxBatchButton({
  calls,
  blocked,
  errors,
  onComplete,
  onError,
}: TxBatchButtonProps) {
  const [state, setState] = useState<"idle" | "processing">("idle");
  const sendCalls = useSendCalls();

  const executeStep = useCallback(async () => {
    setState("processing");

    try {
      // TODO: Inject capaibilites if we want to use paymasters
      const hash = await sendCalls.mutateAsync({ calls });

      // TODO: useCallStatus? there is a specialized hook for this
      if (onComplete) {
        onComplete(hash.id as `0x${string}`);
      }
    } catch (e) {
      console.error("Error executing route:", e);
      onError?.(e);
    } finally {
      setState("idle");
    }
  }, [calls, sendCalls, onComplete, onError]);

  return (
    <TriggerWalletButton
      disabled={blocked || state === "processing"}
      processing={state === "processing"}
      errors={errors}
      onClick={executeStep}
    />
  );
}
