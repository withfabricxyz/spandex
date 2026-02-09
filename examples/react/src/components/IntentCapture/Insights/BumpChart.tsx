import { ResponsiveBump } from "@nivo/bump";
import {
  type QuotePerformance,
  type SimulatedQuote,
  type SuccessfulSimulatedQuote,
  sortQuotesByPerformance,
} from "@spandex/core";
import { type JSX, useCallback, useMemo } from "react";
import { Button } from "@/components/Button";
import { Tooltip } from "@/components/Tooltip";
import type { SwapErrorState } from "@/utils/errors";
import type { Metric } from "@/utils/quoteHelpers";

type BumpChartProps = {
  quoteHistory: SimulatedQuote[][];
  selectedMetric: Metric;
  errors?: SwapErrorState;
  setSelectedMetric: (metric: Metric) => void;
};

export const COLORS: Record<string, string> = {
  fabric: "var(--color-fabric-purple)",
  "0x": "var(--color-fabric-red)",
  odos: "var(--color-fabric-pink)",
  kyberswap: "var(--color-fabric-green)",
  fallback: "#ddd",
  secondary: "var(--color-border)",
  tertiary: "var(--color-outline)",
};

function MetricSelect({
  selectedMetric,
  setSelectedMetric,
}: {
  selectedMetric: Metric;
  setSelectedMetric: (metric: Metric) => void;
}) {
  const handleSelect = useCallback(
    (selected: Metric) => {
      setSelectedMetric(selected);
    },
    [setSelectedMetric],
  );

  return (
    <div className="flex gap-10 items-center">
      <button
        type="button"
        onClick={() => handleSelect("price")}
        className={`text-primary monospace text-[12px] underline decoration-dotted underline-offset-[3px] hover:cursor-pointer hover:decoration-solid ${
          selectedMetric === "price" ? "decoration-solid" : ""
        }`}
      >
        Price
      </button>
      <button
        type="button"
        onClick={() => handleSelect("accuracy")}
        className={`text-primary monospace text-[12px] underline decoration-dotted underline-offset-[3px] hover:cursor-pointer hover:decoration-solid ${
          selectedMetric === "accuracy" ? "decoration-solid" : ""
        }`}
      >
        Accuracy
      </button>

      <button
        type="button"
        onClick={() => handleSelect("latency")}
        className={`text-primary monospace text-[12px] underline decoration-dotted underline-offset-[3px] hover:cursor-pointer hover:decoration-solid ${
          selectedMetric === "latency" ? "decoration-solid" : ""
        }`}
      >
        Latency
      </button>
    </div>
  );
}

// Custom labels layer with overlap detection and adjustment
// biome-ignore lint/suspicious/noExplicitAny: nivo types
function CustomLabelsLayer({ series }: any) {
  if (!series || series.length === 0) return null;

  const LABEL_HEIGHT = 14;
  const MIN_SPACING = 2;
  const LABEL_OFFSET = 10;

  interface LabelData {
    id: string;
    x: number;
    y: number;
    color: string;
    adjustedY: number;
  }

  const labels: LabelData[] = series
    // biome-ignore lint/suspicious/noExplicitAny: nivo types
    .map((serie: any) => {
      const points = serie.linePoints || [];
      if (points.length === 0) return null;

      const lastPoint = points[points.length - 1];
      return {
        id: serie.id,
        x: lastPoint[0],
        y: lastPoint[1],
        color: serie.color || "#999",
        adjustedY: lastPoint[1],
      };
    })
    .filter(Boolean)
    .sort((a: LabelData, b: LabelData) => a.y - b.y);

  // Adjust overlapping labels
  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1];
    const curr = labels[i];
    const minAllowedY = prev.adjustedY + LABEL_HEIGHT + MIN_SPACING;

    if (curr.adjustedY < minAllowedY) {
      curr.adjustedY = minAllowedY;
    }
  }

  return (
    <g>
      {labels.map((label) => (
        <text
          key={`label-${label.id}`}
          x={label.x + LABEL_OFFSET}
          y={label.adjustedY}
          textAnchor="start"
          dominantBaseline="middle"
          style={{
            fontFamily: "Sohne Mono",
            fontSize: 12,
            textTransform: "capitalize",
            fill: label.color,
            pointerEvents: "none",
          }}
        >
          {label.id}
        </text>
      ))}
    </g>
  );
}

// Custom layer to render shadow lines behind the main lines
// biome-ignore lint/suspicious/noExplicitAny: <>
function ShadowLinesLayer({ series, lineGenerator }: any) {
  return (
    <g>
      {/* biome-ignore lint/suspicious/noExplicitAny: <> */}
      {series.map((serie: any) => {
        if (!serie.linePoints || serie.linePoints.length === 0) return null;

        const path = lineGenerator(serie.linePoints);

        return (
          <path
            key={`shadow-${serie.id}`}
            d={path || ""}
            fill="none"
            stroke={COLORS.tertiary}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

// Custom layer to render end point dots
// biome-ignore lint/suspicious/noExplicitAny: <>
function EndPointsLayer({ series }: any) {
  return (
    <g>
      {/* biome-ignore lint/suspicious/noExplicitAny: <> */}
      {series.map((serie: any) => {
        const points = serie.linePoints || [];
        if (points.length === 0) return null;

        const lastPoint = points[points.length - 1];
        const color = serie.color || "#999";

        const x = lastPoint[0];
        const y = lastPoint[1];

        return <circle key={`endpoint-${serie.id}`} cx={x} cy={y} r={6} fill={color} />;
      })}
    </g>
  );
}

// Custom grid layer that constrains vertical lines to data bounds
// biome-ignore lint/suspicious/noExplicitAny: nivo types
function CustomGridLayer({ series, xScale }: any) {
  if (!series || series.length === 0) return null;

  // Find min and max y positions from all data points
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  // biome-ignore lint/suspicious/noExplicitAny: nivo types
  series.forEach((serie: any) => {
    if (!serie.linePoints || serie.linePoints.length === 0) return;
    // biome-ignore lint/suspicious/noExplicitAny: nivo types
    serie.linePoints.forEach((point: any) => {
      const y = point[1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
  });

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;

  // Get all x positions for grid lines
  const xPositions = xScale.domain().map((d: number) => xScale(d));

  return (
    <g>
      {xPositions.map((x: number, i: number) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: <>
          key={`grid-${i}`}
          x1={x}
          x2={x}
          y1={minY}
          y2={maxY}
          stroke={COLORS.secondary}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

const metricMap: Record<Metric, keyof QuotePerformance> = {
  price: "outputAmount",
  accuracy: "accuracy",
  latency: "latency",
};

export function BumpChart({
  quoteHistory,
  errors,
  selectedMetric,
  setSelectedMetric,
}: BumpChartProps) {
  const chartData = useMemo(() => {
    if (quoteHistory.length === 0) return [];

    const providers = new Set<string>(quoteHistory.flat().map((q) => q.provider));
    const providerMap = new Map<string, Array<{ x: number; y: number; failed: boolean }>>();
    for (const provider of providers) {
      providerMap.set(provider, []);
    }

    const metric = metricMap[selectedMetric];

    quoteHistory.forEach((snapshot, timeIndex) => {
      const successfulQuotes = snapshot.filter(
        (q) => q.success && q.simulation.success,
      ) as SuccessfulSimulatedQuote[];
      const sorted = sortQuotesByPerformance({
        quotes: successfulQuotes,
        metric,
        ascending: metric !== "outputAmount",
      });

      // determine rank (where multiple can tie)
      let rank = 1;
      let lastValue: bigint | number | undefined = sorted[0]?.performance[metric];
      const ranks = sorted.map((quote) => {
        if (quote.performance[metric] !== lastValue) {
          rank += 1;
          lastValue = quote.performance[metric];
        }
        return { provider: quote.provider, rank };
      });

      for (const provider of providers) {
        const rank = ranks.find((r) => r.provider === provider);
        providerMap.get(provider)?.push({
          x: timeIndex,
          y: rank?.rank || providers.size,
          failed: rank === undefined,
        });
      }
    });

    return Array.from(providerMap.entries()).map(([provider, data]) => ({
      id: provider,
      color: data[data.length - 1].failed ? COLORS.fallback : COLORS[provider] || COLORS.fallback,
      data,
    }));
  }, [quoteHistory, selectedMetric]);

  const maxRank = useMemo(() => {
    return Math.max(chartData.length, 2);
  }, [chartData]);

  const rowHeight = 40;
  const verticalPadding = 0;
  const chartHeight = maxRank * rowHeight + verticalPadding * 2;

  let chartContent: JSX.Element;
  if (errors?.input.length || errors?.quote.length) {
    chartContent = (
      <div className="bg-surface-mid flex items-center justify-center h-40">
        <span className="monospace text-[12px] text-primary animate-pulse">
          Error fetching quotes
        </span>
      </div>
    );
  } else if (quoteHistory.length === 0) {
    chartContent = (
      <div className="bg-surface-mid flex items-center justify-center h-40">
        <span className="monospace text-[12px] text-primary animate-pulse">Fetching quotes...</span>
      </div>
    );
  } else if (quoteHistory.every((snapshot) => snapshot.every((quote) => !quote.success))) {
    chartContent = (
      <div className="bg-surface-mid flex items-center justify-center h-40">
        <span className="monospace text-[12px] text-primary animate-pulse">
          No successful quotes
        </span>
      </div>
    );
  } else {
    chartContent = (
      <div style={{ height: `${chartHeight}px` }}>
        <ResponsiveBump
          data={chartData}
          colors={(serie) => serie.color}
          lineWidth={2}
          activeLineWidth={2}
          inactiveLineWidth={2}
          inactiveOpacity={0.15}
          pointSize={0}
          activePointSize={0}
          inactivePointSize={0}
          enableGridX={false}
          enableGridY={false}
          xPadding={0}
          xOuterPadding={0}
          lineTooltip={() => <></>}
          margin={{ top: verticalPadding, right: 80, bottom: verticalPadding, left: 0 }}
          layers={[CustomGridLayer, ShadowLinesLayer, "lines", EndPointsLayer, CustomLabelsLayer]}
          axisTop={null}
          axisBottom={null}
          axisLeft={null}
          axisRight={null}
          theme={{
            grid: {
              line: {
                stroke: COLORS.secondary,
                strokeWidth: 1,
              },
            },
            labels: {
              text: {
                fontFamily: "Sohne Mono",
                fontSize: 12,
                textTransform: "capitalize",
              },
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 overflow-hidden relative">
      <a href="https://benchmark.withfabric.xyz">
        <Tooltip
          trigger={
            <Button
              variant="secondary"
              className="absolute px-2 py-4 border-0 top-7 right-0 h-16 w-16 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
              >
                <title>Open Quote Bench</title>
                <path
                  d="M1.4 13L0 11.6L9.6 2H1V0H13V12H11V3.4L1.4 13Z"
                  fill="var(--color-quaternary)"
                />
              </svg>
            </Button>
          }
          content="Open Quotebench"
          dark
        />
      </a>
      <MetricSelect selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric} />
      {chartContent}
    </div>
  );
}
