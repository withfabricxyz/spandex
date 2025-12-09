import { Button } from "@/components/Button";
// import { IconPlus } from "~/components/library/Icons/IconPlus";
// import { Body } from "~/components/library/Typography";
import type { StructuredError } from "@/utils/errors";

export function TriggerWalletButton({
  // variant,
  processing,
  text,
  disabled,
  error,
  onClick,
}: {
  variant: "buy" | "sell";
  text: string;
  disabled: boolean;
  processing: boolean;
  error?: StructuredError;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-8">
      <Button onClick={onClick} size="lg" disabled={disabled || processing}>
        {text}
      </Button>
      {processing && (
        <div className="flex flex-row items-center gap-1 justify-center">
          {/* <IconPlus className="animate-spin fill-acid-10" /> */}
          <span className="text-center text-type-primary-80">Confirm in wallet...</span>
        </div>
      )}
      {error && (
        <div className="text-center">
          <span className="text-red-110">{error.title}</span>
        </div>
      )}
    </div>
  );
}
