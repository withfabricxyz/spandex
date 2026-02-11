import { Button } from "@/components/Button";
import { Loading } from "@/components/icons";
import type { SwapErrorState } from "@/utils/errors";

export function TriggerWalletButton({
  processing,
  disabled,
  errors,
  isFetchingQuotes,
  onClick,
}: {
  disabled: boolean;
  processing: boolean;
  errors?: SwapErrorState;
  isFetchingQuotes: boolean;
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
      {isFetchingQuotes && !processing ? (
        <span className="flex items-center gap-4 text-[12px] text-quaternary justify-center">
          <span>refreshing quotes...</span>
          <span className="h-5 w-5 shrink-0 animate-spin rounded-full border border-current border-t-transparent" />
        </span>
      ) : null}
      {Object.entries(errors || {}).length > 0 ? (
        <div className="flex flex-col gap-4">
          {Object.entries(errors || {}).map(([key, errorCategory]) =>
            errorCategory ? (
              <span key={key} className="text-[12px] text-red text-center">
                {errorCategory.map((error) => (
                  <div key={error.title}>{error.title}</div>
                ))}
              </span>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
