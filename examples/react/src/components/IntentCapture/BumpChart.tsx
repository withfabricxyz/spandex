import { ResponsiveBump } from "@nivo/bump";
import type { SimulatedQuote } from "@withfabric/spandex";
import { useCallback, useMemo, useState } from "react";

type Metric = "latency" | "accuracy" | "price";

const PROVIDER_COLORS: Record<string, string> = {
  fabric: "#8B5CF6",
  "0x": "#FF006B",
  uniswap: "#FF007A",
  odos: "#FB42DF",
  kyberswap: "#117D45",
};

function BumpChartMetrics({
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

export function BumpChart({ history }: { history: SimulatedQuote[][] }) {
  const [metric, setMetric] = useState<Metric>("price");

  const chartData = useMemo(() => {
    if (history.length === 0) return [];

    const providerMap = new Map<string, Array<{ x: number; y: number }>>();

    history.forEach((snapshot, timeIndex) => {
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
  }, [history, metric]);

  return (
    <div className="flex flex-col gap-20">
      <BumpChartMetrics selectedMetric={metric} onMetricSelect={setMetric} />
      {history.length === 0 ? (
        <div className="bg-[#eee] h-80 flex items-center justify-center">
          <span className="font-['Sohne_Mono'] text-[12px] text-[#999]">Fetching quotes...</span>
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveBump
            data={chartData}
            colors={(serie) => PROVIDER_COLORS[serie.id] || "#999"}
            lineWidth={3}
            activeLineWidth={6}
            inactiveLineWidth={3}
            inactiveOpacity={0.15}
            pointSize={0}
            activePointSize={0}
            inactivePointSize={0}
            enableGridX={false}
            enableGridY={true}
            axisTop={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: "",
              legendPosition: "middle",
              legendOffset: 32,
              truncateTickAt: 0,
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: "ranking",
              legendPosition: "middle",
              legendOffset: -40,
              truncateTickAt: 0,
            }}
            margin={{ top: 40, right: 100, bottom: 40, left: 60 }}
            axisRight={null}
            layers={[
              "grid",
              "axes",
              "labels",
              "lines",
              ({ series, xScale, yScale }) => {
                // biome-ignore lint/suspicious/noExplicitAny: <>
                return series.map((serie: any) => {
                  const points = serie.data;
                  const lastPoint = points[points.length - 1];
                  if (!lastPoint) return null;
                  const x = xScale(lastPoint.x);
                  const y = yScale(lastPoint.y);
                  return (
                    <g key={serie.id}>
                      <circle
                        cx={x}
                        cy={y}
                        r={6}
                        fill="#fff"
                        stroke={serie.color}
                        strokeWidth={3}
                      />
                    </g>
                  );
                });
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
