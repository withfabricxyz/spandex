import type { SuccessfulQuote } from "@spandex/core";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Skeleton } from "../../../Skeleton";
import { Tooltip } from "../../../Tooltip";
import { COLORS } from "../BumpChart";

export const PROVIDERS = ["fabric", "0x", "odos", "kyberswap"] as const;

export type BaseRow = { provider: string; color: string };

export function skeletonCell() {
  return (
    <div className="ml-auto w-fit">
      <Skeleton height={12} width={50} />
    </div>
  );
}

function TooltipTable<TData>({ data, columns }: { data: TData[]; columns: ColumnDef<TData>[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  return (
    <table className="w-full monospace text-[12px]">
      <thead className="border-b border-surface-high">
        {headerGroups.map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id} className="text-right first:text-left py-10 font-medium">
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

// handle streaming input of quotes and build rows for provider performance table, provides consistent ordering and pending/missing data
export function buildProviderRows<TValues extends Record<string, string | null>>(
  quotes: SuccessfulQuote[],
  sort: (a: SuccessfulQuote, b: SuccessfulQuote) => number,
  getValues: (quote: SuccessfulQuote, index: number, sorted: SuccessfulQuote[]) => TValues,
  nullValues: TValues,
): (BaseRow & TValues)[] {
  const quotesByProvider = new Map(quotes.map((q) => [q.provider.toLowerCase(), q]));
  const sorted = quotes.sort(sort);
  const sortedKeys = sorted.map((q) => q.provider.toLowerCase());
  const pending = PROVIDERS.filter((p) => !quotesByProvider.has(p));

  // we want to show responded providers first, sorted by performance, then unresponded providers
  const responded: (BaseRow & TValues)[] = [];
  const unresponded: (BaseRow & TValues)[] = [];

  for (const [idx, p] of sortedKeys.entries()) {
    const q = quotesByProvider.get(p);
    if (!q) {
      unresponded.push({ provider: p, color: COLORS[p], ...nullValues });
      continue;
    }
    const values = getValues(q, idx, sorted);
    const hasData = Object.values(values).some((v) => v !== null);
    const row = { provider: q.provider, color: COLORS[p], ...values };
    if (hasData) responded.push(row);
    else unresponded.push(row);
  }

  for (const p of pending) {
    unresponded.push({ provider: p, color: COLORS[p], ...nullValues });
  }

  return [...responded, ...unresponded];
}

// renders either the simple or dynamic table-based tooltip. each one has slightly different styles as well
export function BaseInsightTooltip<TRow>(
  props:
    | { label: string; description: string }
    | { label: string; heading: string; data: TRow[]; columns: ColumnDef<TRow>[] },
) {
  const isTable = "data" in props && "columns" in props;

  return (
    <Tooltip
      dark={!isTable}
      trigger={
        <span
          className="underline cursor-pointer decoration-dotted hover:decoration-solid"
          style={{ textUnderlineOffset: "25%" }}
        >
          {props.label}
        </span>
      }
      content={
        isTable ? (
          <>
            <span className="font-[Sohne_Breit] text-[16px] font-medium text-exact-height">
              {props.heading}
            </span>
            <TooltipTable data={props.data} columns={props.columns} />
          </>
        ) : (
          <div className="flex flex-col gap-8">
            <span className="monospace text-[12px]">{props.description}</span>
          </div>
        )
      }
    />
  );
}
