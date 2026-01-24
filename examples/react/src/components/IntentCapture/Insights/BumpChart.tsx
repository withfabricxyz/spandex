import { ResponsiveBump } from "@nivo/bump";
import type { SimulatedQuote } from "@withfabric/spandex";
import { useCallback, useMemo } from "react";
import type { Metric } from "@/utils/quoteHelpers";

type BumpChartProps = {
  quoteHistory: SimulatedQuote[][];
  selectedMetric: Metric;
  setSelectedMetric: (metric: Metric) => void;
};

export const COLORS: Record<string, string> = {
  fabric: "var(--color-fabric-purple)",
  "0x": "var(--color-fabric-red)",
  odos: "var(--color-fabric-pink)",
  kyberswap: "var(--color-fabric-green)",
  fallback: "#999999",
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
        const color = COLORS[serie.id] || "#999";

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

export function BumpChart({ quoteHistory, selectedMetric, setSelectedMetric }: BumpChartProps) {
  const chartData = useMemo(() => {
    if (quoteHistory.length === 0) return [];

    const providerMap = new Map<string, Array<{ x: number; y: number }>>();

    quoteHistory.forEach((snapshot, timeIndex) => {
      const successfulQuotes = snapshot.filter((q) => q.success);

      if (successfulQuotes.length === 0) return;

      let sortedQuotes: SimulatedQuote[];
      if (selectedMetric === "latency") {
        sortedQuotes = [...successfulQuotes].sort((a, b) => (a.latency || 0) - (b.latency || 0));
      } else if (selectedMetric === "accuracy") {
        // accuracy === simmed out vs quoted out
        sortedQuotes = [...successfulQuotes].sort((a, b) => {
          const simmedA = a.simulation.success ? a.simulation.outputAmount : 0n;
          const simmedB = b.simulation.success ? b.simulation.outputAmount : 0n;
          const diffA = Math.abs(Number(a.outputAmount) - Number(simmedA));
          const diffB = Math.abs(Number(b.outputAmount) - Number(simmedB));

          return diffA - diffB;
        });
      } else {
        // "higher" price is better
        sortedQuotes = [...successfulQuotes].sort(
          (a, b) => Number(b.outputAmount) - Number(a.outputAmount),
        );
      }

      sortedQuotes.forEach((quote, rank) => {
        if (!providerMap.has(quote.provider)) {
          providerMap.set(quote.provider, []);
        }
        providerMap.get(quote.provider)?.push({
          x: timeIndex,
          y: rank + 1,
        });
      });
    });

    return Array.from(providerMap.entries()).map(([provider, data]) => ({
      id: provider,
      data,
    }));
  }, [quoteHistory, selectedMetric]);

  const maxRank = useMemo(() => {
    if (chartData.length === 0) return 2;
    return Math.max(...chartData.flatMap((serie) => serie.data.map((d) => d.y)));
  }, [chartData]);

  const rowHeight = 40;
  const verticalPadding = 0;
  const chartHeight = maxRank * rowHeight + verticalPadding * 2;

  return (
    <div className="flex flex-col gap-5 overflow-hidden">
      <MetricSelect selectedMetric={selectedMetric} setSelectedMetric={setSelectedMetric} />
      {quoteHistory.length === 0 ? (
        <div
          className="bg-surface-mid flex items-center justify-center"
          style={{ height: `${chartHeight}px` }}
        >
          <span className="monospace text-[12px] text-primary animate-pulse">
            Fetching quotes...
          </span>
        </div>
      ) : (
        <div style={{ height: `${chartHeight}px` }}>
          <ResponsiveBump
            data={chartData}
            colors={(serie) => COLORS[serie.id] || COLORS.fallback}
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
            layers={[CustomGridLayer, ShadowLinesLayer, "lines", EndPointsLayer, "labels"]}
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
      )}
    </div>
  );
}
