import { Button } from "@/components/Button";
// import { IconPlus } from "~/components/library/Icons/IconPlus";
// import { Body } from "~/components/library/Typography";
import type { StructuredError } from "@/utils/errors";

export function TriggerWalletButton({
  // variant,
  processing,
  disabled,
  error,
  onClick,
}: {
  variant: "buy" | "sell";
  disabled: boolean;
  processing: boolean;
  error?: StructuredError;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-8">
      <Button onClick={onClick} size="lg" disabled={disabled || processing}>
        swap
      </Button>
      {processing && (
        <div className="flex flex-row items-center gap-1 justify-center">
          {/* <IconPlus className="animate-spin fill-acid-10" /> */}
          <span className="text-center text-tertiary">Confirm in wallet...</span>
        </div>
      )}
      {error && (
        <div className="text-center">
          <span className="text-red">{error.title}</span>
        </div>
      )}
    </div>
  );
}
