import { ResponsiveBump } from "@nivo/bump";
import type { SimulatedQuote } from "@withfabric/spandex";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TokenMetadata } from "@/services/tokens";

type BumpChartProps = {
  quotes?: SimulatedQuote[];
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  numSellTokens: string;
};

type Metric = "latency" | "accuracy" | "price";

const COLORS: Record<string, string> = {
  fabric: "#8B5CF6",
  "0x": "#FF006B",
  uniswap: "#FF007A",
  odos: "#FB42DF",
  kyberswap: "#117D45",
  fallback: "#999999",
  secondary: "rgba(179, 179, 179, 0.20)",
  tertiary: "rgba(179, 179, 179, 0.10)",
};

function MetricSelect({
  selectedMetric,
  onMetricSelect,
}: {
  selectedMetric: Metric;
  onMetricSelect: (metric: Metric) => void;
}) {
  const handleSelect = useCallback(
    (selected: Metric) => {
      onMetricSelect(selected);
    },
    [onMetricSelect],
  );

  return (
    <div className="flex gap-10 items-center">
      <button
        type="button"
        onClick={() => handleSelect("latency")}
        className={`font-['Sohne_Mono'] text-[12px] underline decoration-dotted underline-offset-[3px] hover:cursor-pointer hover:decoration-solid ${
          selectedMetric === "latency" ? "decoration-solid" : ""
        }`}
      >
        Latency
      </button>
      <button
        type="button"
        onClick={() => handleSelect("accuracy")}
        className={`font-['Sohne_Mono'] text-[12px] underline decoration-dotted underline-offset-[3px] hover:cursor-pointer hover:decoration-solid ${
          selectedMetric === "accuracy" ? "decoration-solid" : ""
        }`}
      >
        Accuracy
      </button>
      <button
        type="button"
        onClick={() => handleSelect("price")}
        className={`font-['Sohne_Mono'] text-[12px] underline decoration-dotted underline-offset-[3px] hover:cursor-pointer hover:decoration-solid ${
          selectedMetric === "price" ? "decoration-solid" : ""
        }`}
      >
        Price
      </button>
    </div>
  );
}

// Custom layer to render shadow lines behind the main lines
// biome-ignore lint/suspicious/noExplicitAny: <>
const ShadowLinesLayer = ({ series, lineGenerator }: any) => {
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
};

// Custom layer to render end point dots
// biome-ignore lint/suspicious/noExplicitAny: <>
const EndPointsLayer = ({ series }: any) => {
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

        return (
          <circle
            key={`endpoint-${serie.id}`}
            cx={x}
            cy={y}
            r={6}
            fill={color}
          />
        );
      })}
    </g>
  );
};

export function BumpChart({ quotes, sellToken, buyToken, numSellTokens }: BumpChartProps) {
  const [quoteHistory, setQuoteHistory] = useState<SimulatedQuote[][]>([]);
  const [metric, setMetric] = useState<Metric>("price");

  // reset history when swap parameters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally resetting on input changes
  useEffect(() => {
    setQuoteHistory([]);
  }, [sellToken.address, buyToken.address, numSellTokens]);

  // store quotes in history whenever we get a new set of quotes
  useEffect(() => {
    if (quotes && quotes.length > 0) {
      setQuoteHistory((prev) => [...prev, quotes].slice(-20)); // limit to last 20?
    }
  }, [quotes]);

  const chartData = useMemo(() => {
    if (quoteHistory.length === 0) return [];

    const providerMap = new Map<string, Array<{ x: number; y: number }>>();

    quoteHistory.forEach((snapshot, timeIndex) => {
      const successfulQuotes = snapshot.filter((q) => q.success);

      if (successfulQuotes.length === 0) return;

      let sortedQuotes: SimulatedQuote[];
      if (metric === "latency") {
        sortedQuotes = [...successfulQuotes].sort((a, b) => (a.latency || 0) - (b.latency || 0));
      } else if (metric === "accuracy") {
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
  }, [quoteHistory, metric]);

  const maxRank = useMemo(() => {
    if (chartData.length === 0) return 2;
    return Math.max(...chartData.flatMap((serie) => serie.data.map((d) => d.y)));
  }, [chartData]);

  const chartHeight = maxRank * 20 + 40; // 40px per rank + 40px padding

  return (
    <div className="flex flex-col gap-20 overflow-hidden">
      <MetricSelect selectedMetric={metric} onMetricSelect={setMetric} />
      {quoteHistory.length === 0 ? (
        <div
          className="bg-[#eee] flex items-center justify-center"
          style={{ height: `${chartHeight}px` }}
        >
          <span className="font-['Sohne_Mono'] text-[12px] text-[#999]">Fetching quotes...</span>
        </div>
      ) : (
        <div style={{ height: `${chartHeight}px` }}>
          <ResponsiveBump
            data={chartData}
            colors={(serie) => COLORS[serie.id] || COLORS.fallback}
            lineWidth={2}
            activeLineWidth={6}
            inactiveLineWidth={2}
            inactiveOpacity={0.15}
            pointSize={0}
            activePointSize={0}
            inactivePointSize={0}
            enableGridX={true}
            enableGridY={false}
            xPadding={0}
            xOuterPadding={0}
            margin={{ top: 0, right: 80, bottom: 0, left: 0 }}
            layers={["grid", ShadowLinesLayer, "lines", EndPointsLayer, "labels"]}
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
                  textTransform: "capitalize"
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
