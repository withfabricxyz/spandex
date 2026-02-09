import { useEffect, useMemo, useState } from "react";

export function QuoteRefreshCountdown({
  fetching,
  updatedAt,
  durationMs,
  enabled,
}: {
  fetching: boolean;
  updatedAt: number;
  durationMs: number;
  enabled: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => clearInterval(timer);
  }, [enabled]);

  const statusText = useMemo(() => {
    if (!enabled) return null;
    if (fetching) return "refreshing quotes";
    if (!updatedAt) return `refreshing quotes in ${Math.ceil(durationMs / 1_000)}s`;

    const elapsedMs = now - updatedAt;
    const remainingMs = Math.max(0, durationMs - elapsedMs);
    return `refreshing quotes in ${Math.ceil(remainingMs / 1_000)}s`;
  }, [enabled, fetching, updatedAt, durationMs, now]);

  if (!statusText) return null;

  if (fetching) {
    return (
      <span className="flex items-center gap-4 monospace text-[11px] text-quaternary">
        <span>{statusText}</span>
        <span className="h-5 w-5 shrink-0 animate-spin rounded-full border border-current border-t-transparent" />
      </span>
    );
  }

  return <span className="monospace text-[11px] text-quaternary">{statusText}</span>;
}
