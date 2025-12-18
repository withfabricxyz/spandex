import { call as wagmiCall } from "@wagmi/core";
import { useCallback, useState } from "react";
import { useAccount, useConfig, useSendTransaction } from "wagmi";
// import { toast } from "~/components/library/Toast";
// import { getExplorerLink } from "~/config/onchain";
import { type StructuredError, structureError } from "@/utils/errors";
import type { TxBatchButtonProps } from ".";
import { TriggerWalletButton } from "./TriggerWalletButton";

const dwellTime = 2500; // 1 second

export function SequencedWalletTxBatchButton({
  variant,
  calls,
  blocked,
  onComplete,
}: TxBatchButtonProps) {
  const [error, setError] = useState<StructuredError | undefined>(undefined);
  const [state, setState] = useState<"idle" | "processing">("idle");

  const { address } = useAccount();
  const config = useConfig();
  const { sendTransactionAsync } = useSendTransaction();

  const executeStep = useCallback(async () => {
    setError(undefined);
    setState("processing");

    try {
      for (const call of calls) {
        // Simulate the call before sending the transaction
        await wagmiCall(config, {
          account: address,
          data: call.data,
          to: call.to,
        });

        const hash = await sendTransactionAsync(call);
        console.log("Transaction submitted with hash:", hash);
        // toast(`${call.name} Tx Submitted`, {
        //   link: getExplorerLink(call.chainId, "tx", hash),
        // });
        await new Promise((resolve) => setTimeout(resolve, dwellTime)); // Wait for dwell time before next transaction
      }

      if (onComplete) {
        await onComplete();
      }
    } catch (e) {
      console.error("Error executing route:", e);
      setError(structureError(e));
    } finally {
      setState("idle");
    }
  }, [calls, sendTransactionAsync, onComplete, config, address]);

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
