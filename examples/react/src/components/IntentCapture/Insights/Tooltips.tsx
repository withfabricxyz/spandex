import type { SimulatedQuote, SuccessfulQuote } from "@spandex/core";
import type { ColumnDef } from "@tanstack/react-table";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import type { TokenMetadata } from "@/services/tokens";
import { getQuoteInaccuracy } from "@/utils/quoteHelpers";
import { Tooltip } from "../../Tooltip";
import { COLORS } from "./BumpChart";

function TooltipTable<TData>({ data, columns }: { data: TData[]; columns: ColumnDef<TData>[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  return (
    <table className="w-full monospace text-[12px] text-surface-base">
      <thead className="border-b border-surface-high">
        {headerGroups.map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="text-right first:text-left py-10 font-normal">
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={`text-right first:text-left py-5 ${rowIndex === 0 ? "pt-10" : ""} ${rowIndex === rows.length - 1 ? "pb-0" : ""}`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type LatencyRow = {
  provider: string;
  time: string;
  gap: string;
  color: string;
};

export function LatencyTooltip({ successfulQuotes }: { successfulQuotes: SuccessfulQuote[] }) {
  const columnHelper = createColumnHelper<{
    provider: string;
    time: string;
    gap: string;
    color: string;
  }>();

  const data = useMemo(() => {
    if (successfulQuotes.length === 0) return [];

    const sorted = [...successfulQuotes].sort((a, b) => a.latency - b.latency);
    return sorted.map((q, i) => {
      const isLast = i === sorted.length - 1;
      const gap = isLast ? null : q.latency - sorted[i + 1].latency;
      return {
        provider: q.provider,
        time: `${q.latency.toFixed(1)}ms`,
        gap: gap === null ? "--" : `${gap.toFixed(1)}ms`,
        color: COLORS[q.provider.toLowerCase()],
      };
    });
  }, [successfulQuotes]);

  const columns = useMemo(
    () => [
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
      }),
      columnHelper.accessor("gap", {
        header: "Gap",
      }),
    ],
    [columnHelper],
  );

  return (
    <Tooltip
      trigger={
        <span
          className="underline cursor-pointer decoration-dotted hover:decoration-solid"
          style={{ textUnderlineOffset: "25%" }}
        >
          Latency
        </span>
      }
      content={
        <>
          <span className="text-surface-base font-[Sohne_Breit] text-[16px]">
            How long did it take to provide a quote?
          </span>
          <TooltipTable data={data} columns={columns as ColumnDef<LatencyRow>[]} />
        </>
      }
    ></Tooltip>
  );
}

type InaccuracyRow = {
  provider: string;
  delta: string;
  gap: string;
  color: string;
};

export function InaccuracyTooltip({ successfulQuotes }: { successfulQuotes: SuccessfulQuote[] }) {
  const columnHelper = createColumnHelper<InaccuracyRow>();

  const data = useMemo(() => {
    if (successfulQuotes.length === 0) return [];

    const items = successfulQuotes
      .map((q) => ({ quote: q, inaccuracy: getQuoteInaccuracy(q as SimulatedQuote) }))
      .filter((item) => item.inaccuracy !== null)
      .sort((a, b) => (a.inaccuracy || 0) - (b.inaccuracy || 0));

    return items.map((item, i) => {
      const { quote: q, inaccuracy } = item;
      const isLast = i === items.length - 1;
      const gap = isLast ? null : (items[i + 1].inaccuracy || 0) - (inaccuracy || 0);

      return {
        provider: q.provider,
        delta: `${((inaccuracy || 0) / 100).toFixed(3)}bps`,
        gap: gap === null ? "--" : `${(gap / 100).toFixed(3)}bps`,
        color: COLORS[q.provider.toLowerCase()],
      };
    });
  }, [successfulQuotes]);

  const columns = useMemo(
    () => [
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
      }),
      columnHelper.accessor("gap", {
        header: "Gap",
      }),
    ],
    [columnHelper],
  );

  return (
    <Tooltip
      trigger={
        <span
          className="underline cursor-pointer decoration-dotted hover:decoration-solid"
          style={{ textUnderlineOffset: "25%" }}
        >
          Inaccuracy
        </span>
      }
      content={
        <div className="flex flex-col gap-8">
          <span className="text-surface-base font-[Sohne_Breit] text-[16px]">
            How wide was the delta between quote and execution?
          </span>
          <TooltipTable data={data} columns={columns as ColumnDef<InaccuracyRow>[]} />
        </div>
      }
    />
  );
}

type PriceRow = {
  provider: string;
  rate: string;
  delta: string;
  gap: string;
  color: string;
};

export function PriceTooltip({
  successfulQuotes,
  sellToken,
  buyToken,
}: {
  successfulQuotes: SuccessfulQuote[];
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
}) {
  const columnHelper = createColumnHelper<PriceRow>();

  const data = useMemo(() => {
    if (successfulQuotes.length === 0) return [];

    const items = successfulQuotes.map((q) => ({
      quote: q,
      rate:
        Number((q.outputAmount * BigInt(10 ** sellToken.decimals)) / q.inputAmount) /
        10 ** buyToken.decimals,
    }));

    const sorted = items.sort((a, b) => b.rate - a.rate);
    const baseline = sorted[sorted.length - 1].rate;

    return sorted.map((item, i) => {
      const { quote: q, rate } = item;
      const isLast = i === sorted.length - 1;
      const delta = ((rate - baseline) / baseline) * 100;
      const gap = isLast ? null : ((rate - sorted[i + 1].rate) / baseline) * 10000;

      return {
        provider: q.provider,
        rate: rate.toFixed(8),
        delta: isLast ? "(Baseline)" : `${delta.toFixed(4)}%`,
        gap: gap === null ? "--" : `${gap.toFixed(1)}bps`,
        color: COLORS[q.provider.toLowerCase()],
      };
    });
  }, [successfulQuotes, sellToken, buyToken]);

  const columns = useMemo(
    () => [
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
      }),
      columnHelper.accessor("delta", {
        header: "Delta",
      }),
      columnHelper.accessor("gap", {
        header: "Gap",
      }),
    ],
    [buyToken.symbol, columnHelper],
  );

  return (
    <Tooltip
      trigger={
        <span
          className="underline cursor-pointer decoration-dotted hover:decoration-solid"
          style={{ textUnderlineOffset: "25%" }}
        >
          Price
        </span>
      }
      content={
        <div className="flex flex-col gap-8">
          <span className="text-surface-base font-[Sohne_Breit] text-[16px]">
            How does the token output vs input compare to peers?
          </span>
          <TooltipTable data={data} columns={columns as ColumnDef<PriceRow>[]} />
        </div>
      }
    />
  );
}

export function GasTooltip() {
  return (
    <Tooltip
      trigger={
        <span
          className="underline cursor-pointer decoration-dotted hover:decoration-solid"
          style={{ textUnderlineOffset: "25%" }}
        >
          Gas
        </span>
      }
      content={
        <div className="flex flex-col gap-8">
          <span className="monospace text-surface-base text-[12px]">
            The network fee required to process this transaction on-chain.
          </span>
        </div>
      }
    />
  );
}

export function MaxSlippageTooltip() {
  return (
    <Tooltip
      trigger={
        <span
          className="underline cursor-pointer decoration-dotted hover:decoration-solid"
          style={{ textUnderlineOffset: "25%" }}
        >
          Max Slippage
        </span>
      }
      content={
        <div className="flex flex-col gap-8">
          <span className="monospace text-surface-base text-[12px]">
            How much the price is allowed to change before your trade reverts.
          </span>
        </div>
      }
    />
  );
}

export function PriceImpactTooltip() {
  return (
    <Tooltip
      trigger={
        <span
          className="underline cursor-pointer decoration-dotted hover:decoration-solid"
          style={{ textUnderlineOffset: "25%" }}
        >
          Price Impact
        </span>
      }
      content={
        <div className="flex flex-col gap-8">
          <span className="monospace text-surface-base text-[12px]">
            How much your trade moves the market price.
          </span>
        </div>
      }
    />
  );
}
