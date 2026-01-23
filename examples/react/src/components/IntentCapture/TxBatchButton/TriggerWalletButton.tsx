import { Button } from "@/components/Button";

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
        swap
      </Button>
    </div>
  );
}
