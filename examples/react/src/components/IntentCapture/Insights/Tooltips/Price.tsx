import type { SuccessfulQuote } from "@spandex/core";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import type { TokenMetadata } from "@/services/tokens";
import { BaseInsightTooltip, type BaseRow, buildProviderRows, skeletonCell } from "./shared";

type PriceRow = BaseRow & { rate: string | null; delta: string | null; gap: string | null };
const columnHelper = createColumnHelper<PriceRow>();

export function PriceTooltip({
  successfulQuotes,
  sellToken,
  buyToken,
}: {
  successfulQuotes: SuccessfulQuote[];
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
}) {
  const { decimals: sellDecimals } = sellToken;
  const { decimals: buyDecimals } = buyToken;

  const data = useMemo(() => {
    const toRate = (q: SuccessfulQuote) =>
      Number((q.outputAmount * BigInt(10 ** sellDecimals)) / q.inputAmount) / 10 ** buyDecimals;

    return buildProviderRows<{ rate: string | null; delta: string | null; gap: string | null }>(
      successfulQuotes,
      (a, b) => toRate(b) - toRate(a),
      (q, idx, sorted) => {
        const rate = toRate(q);
        const baseline = toRate(sorted[sorted.length - 1]);
        const isLast = idx === sorted.length - 1;
        const priceDelta = ((rate - baseline) / baseline) * 100;
        const gap = isLast ? null : ((rate - toRate(sorted[idx + 1])) / baseline) * 10000;
        return {
          rate: rate.toFixed(8),
          delta: isLast ? "(Baseline)" : `${priceDelta.toFixed(4)}%`,
          gap: gap === null ? "--" : `${gap.toFixed(1)}bps`,
        };
      },
      { rate: null, delta: null, gap: null },
    );
  }, [successfulQuotes, sellDecimals, buyDecimals]);

  const columns = [
    columnHelper.accessor("provider", {
      header: "Aggregator",
      cell: (info) => (
        <span className="capitalize" style={{ color: info.row.original.color }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("rate", {
      header: buyToken.symbol,
      cell: (info) => info.getValue() ?? skeletonCell(),
    }),
    columnHelper.accessor("delta", {
      header: "Delta",
      cell: (info) => info.getValue() ?? skeletonCell(),
    }),
    columnHelper.accessor("gap", {
      header: "Gap",
      cell: (info) => info.getValue() ?? skeletonCell(),
    }),
  ] as ColumnDef<PriceRow>[];

  return (
    <BaseInsightTooltip
      label="Price"
      heading="How does the token output vs input compare to peers?"
      data={data}
      columns={columns}
    />
  );
}
