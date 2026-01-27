import { Button } from "@/components/Button";
import { Loading } from "@/components/icons";

export function TriggerWalletButton({
  processing,
  disabled,
  onClick,
}: {
  disabled: boolean;
  processing: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-8">
      <Button onClick={onClick} size="lg" disabled={disabled || processing}>
        {processing ? <Loading className="h-16 w-16 fill-surface-base" /> : "Swap"}
      </Button>
      {processing ? (
        <span className="text-[12px] text-secondary text-center">Processing...</span>
      ) : null}
    </div>
  );
}
