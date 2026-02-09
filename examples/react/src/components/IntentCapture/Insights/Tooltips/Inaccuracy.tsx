import type { SimulatedQuote, SuccessfulQuote } from "@spandex/core";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { getQuoteInaccuracy } from "@/utils/quoteHelpers";
import { BaseInsightTooltip, type BaseRow, buildProviderRows, skeletonCell } from "./shared";

type InaccuracyRow = BaseRow & { delta: string | null; gap: string | null };
const columnHelper = createColumnHelper<InaccuracyRow>();

export function InaccuracyTooltip({ successfulQuotes }: { successfulQuotes: SuccessfulQuote[] }) {
  const sortFn = useCallback((a: SuccessfulQuote, b: SuccessfulQuote) => {
    const inaccuracyA = getQuoteInaccuracy(a as SimulatedQuote) || 0;
    const inaccuracyB = getQuoteInaccuracy(b as SimulatedQuote) || 0;
    return inaccuracyA - inaccuracyB;
  }, []);

  const getValues = useCallback((q: SuccessfulQuote, idx: number, sorted: SuccessfulQuote[]) => {
    const inaccuracy = getQuoteInaccuracy(q as SimulatedQuote);
    if (inaccuracy === null) return { delta: null, gap: null };
    const isLast = idx === sorted.length - 1;
    const nextInaccuracy = isLast ? null : getQuoteInaccuracy(sorted[idx + 1] as SimulatedQuote);
    const gap = nextInaccuracy === null ? null : nextInaccuracy - inaccuracy;
    return {
      delta: `${(inaccuracy / 100).toFixed(3)}bps`,
      gap: gap === null ? "--" : `${(gap / 100).toFixed(3)}bps`,
    };
  }, []);

  const data = useMemo(
    () => buildProviderRows(successfulQuotes, sortFn, getValues, { delta: null, gap: null }),
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
    columnHelper.accessor("delta", {
      header: "Delta",
      cell: (info) => info.getValue() ?? skeletonCell(),
    }),
    columnHelper.accessor("gap", {
      header: "Gap",
      cell: (info) => info.getValue() ?? skeletonCell(),
    }),
  ] as ColumnDef<InaccuracyRow>[];

  return (
    <BaseInsightTooltip
      label="Inaccuracy"
      heading="How wide was the delta between quote and execution?"
      data={data}
      columns={columns}
    />
  );
}
