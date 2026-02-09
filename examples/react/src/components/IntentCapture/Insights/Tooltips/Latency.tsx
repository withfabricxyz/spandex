import type { SuccessfulQuote } from "@spandex/core";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { BaseInsightTooltip, type BaseRow, buildProviderRows, skeletonCell } from "./shared";

type LatencyRow = BaseRow & { time: string | null; gap: string | null };
const columnHelper = createColumnHelper<LatencyRow>();

export function LatencyTooltip({ successfulQuotes }: { successfulQuotes: SuccessfulQuote[] }) {
  const sortFn = useCallback((a: SuccessfulQuote, b: SuccessfulQuote) => a.latency - b.latency, []);

  const getValues = useCallback((q: SuccessfulQuote, idx: number, sorted: SuccessfulQuote[]) => {
    const isLast = idx === sorted.length - 1;
    const gap = isLast ? null : q.latency - sorted[idx + 1].latency;
    return {
      time: `${q.latency.toFixed(1)}ms`,
      gap: gap === null ? "--" : `${gap.toFixed(1)}ms`,
    };
  }, []);

  const data = useMemo(
    () =>
      buildProviderRows<{ time: string | null; gap: string | null }>(
        successfulQuotes,
        sortFn,
        getValues,
        { time: null, gap: null },
      ),
    [successfulQuotes, sortFn, getValues],
  );

  const columns = [
    columnHelper.accessor("provider", {
      header: "Aggregator",
      cell: (info) => (
        <span className="capitalize" style={{ color: info.row.original.color }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("time", {
      header: "Time",
      cell: (info) => info.getValue() ?? skeletonCell(),
    }),
    columnHelper.accessor("gap", {
      header: "Gap",
      cell: (info) => info.getValue() ?? skeletonCell(),
    }),
  ] as ColumnDef<LatencyRow>[];

  return (
    <BaseInsightTooltip
      label="Latency"
      heading="How long did it take to provide a quote?"
      data={data}
      columns={columns}
    />
  );
}
