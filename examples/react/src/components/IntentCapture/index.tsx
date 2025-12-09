import { ResponsiveBump } from "@nivo/bump";
import type { SimulatedQuote } from "@withfabric/spandex";
import { useQuotes } from "@withfabric/spandex-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
// import { SUPPORTED_BASE_TOKENS } from "@/constants/tokens";
import { useTokenDrawer } from "@/providers/TokenDrawerProvider";
import type { TokenMetadata } from "@/services/tokens";
import { Button } from "../Button";
import { TxBatchButton } from "./TxBatchButton";

type TokenControlProps = {
  token: TokenMetadata;
  onChange: (value: string) => void;
};

type Metric = "latency" | "accuracy" | "price";

function SellToken({ token, onChange }: TokenControlProps) {
  const { setIsDrawerOpen } = useTokenDrawer();

  return (
    <div className="flex flex-col gap-10">
      <span>Sell</span>
      <div className="flex justify-between items-center">
        <input
          type="text"
          className="w-full text-primary text-[56px] leading-1 h-22"
          value="20"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button onClick={() => setIsDrawerOpen(true)}>
          <div className="flex items-center gap-4 pr-4">
            <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
            <span className="font-['Sohne_Breit'] text-[20px]">{token.symbol}</span>
            <div className="h-12 w-12 flex items-center">
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: <> */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
              >
                <path d="M6 7.4L0 1.4L1.4 0L6 4.6L10.6 0L12 1.4L6 7.4Z" fill="#0F0F0F" />
              </svg>
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}

function BuyToken({ token, onChange }: TokenControlProps) {
  const { setIsDrawerOpen } = useTokenDrawer();

  return (
    <div className="flex flex-col gap-10">
      <span>Buy</span>
      <div className="flex justify-between items-center">
        <input
          type="text"
          className="w-full text-primary text-[56px] leading-1 h-22"
          value="0.00022448"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button onClick={() => setIsDrawerOpen(true)}>
          <div className="flex items-center gap-4 pr-4">
            <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
            <span className="font-['Sohne_Breit'] text-[20px]">{token.symbol}</span>
            <div className="h-12 w-12 flex items-center">
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: <> */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
              >
                <path d="M6 7.4L0 1.4L1.4 0L6 4.6L10.6 0L12 1.4L6 7.4Z" fill="#0F0F0F" />
              </svg>
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
}

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

function BumpChart({ history }: { history: SimulatedQuote[][] }) {
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

function LineItems() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Winning Aggregator</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-fabric-purple">Fabric</span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Latency</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">69.4ms</span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Inaccuracy</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">0bps</span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Price</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">
          1 USDC = 0.00001122 WBTC
        </span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Gas</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">$0.10</span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Max Slippage</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">1.00% ($0.20)</span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Price Impact</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">0.01% ($0.002)</span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Positive Slippage</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">0% ($0.00)</span>
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-[#666]">Fee</span>
        <span className="font-['Sohne_Mono'] text-[12px] text-primary">0.10% ($0.02)</span>
      </div>
    </div>
  );
}

type SwapParams = {
  inputToken: Address;
  outputToken: Address;
  chainId?: number;
  slippageBps: number;
  swapperAccount?: Address;
  amount: bigint;
  mode: "exactIn" | "targetOut";
};

function SwapButton({ swapParams }: { swapParams: SwapParams }) {
  return (
    <TxBatchButton
      variant="sell"
      blocked={false}
      calls={[
        {
          name: "Swap",
          to: "0x0000000000000000000000000000000000000000",
          data: "0x",
          chainId: swapParams.chainId || 1,
        },
      ]}
    />
  );
}

export function IntentCapture({
  sellToken,
  buyToken,
}: {
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
}) {
  const [numSellTokens, setNumSellTokens] = useState<string>("20");
  const [numBuyTokens, setNumBuyTokens] = useState<string>("0.00022448");
  const [mode, _setMode] = useState<"exactIn" | "targetOut">("exactIn");
  const [quoteHistory, setQuoteHistory] = useState<SimulatedQuote[][]>([]);

  const swap = useMemo(() => {
    if (mode === "exactIn") {
      const inputAmount = Number(numSellTokens) * 10 ** sellToken.decimals;

      if (!inputAmount) return null;

      return {
        chainId: 8453,
        inputToken: sellToken.address,
        outputToken: buyToken.address,
        slippageBps: 100,
        mode: "exactIn",
        inputAmount,
      };
    }

    const outputAmount = Number(numBuyTokens) * 10 ** buyToken.decimals;

    if (!outputAmount) return null;

    return {
      chainId: 8453,
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps: 100,
      mode: "targetOut",
      outputAmount: Number(numBuyTokens) * 10 ** buyToken.decimals,
    };
  }, [sellToken, buyToken, mode, numSellTokens, numBuyTokens]);

  const { data /*, isLoading, error*/ } = useQuotes({
    // TODO: swap type
    // @ts-expect-error
    swap,
    query: {
      refetchInterval: 2500,
    },
  });

  // store quotes in history whenever we get a new set of quotes
  useEffect(() => {
    if (data && data.length > 0) {
      setQuoteHistory((prev) => [...prev, data].slice(-20)); // limit to last 20?
    }
  }, [data]);

  const swapParams: SwapParams = useMemo(
    () => ({
      inputToken: sellToken.address,
      outputToken: buyToken.address,
      slippageBps: 100,
      amount:
        mode === "exactIn"
          ? BigInt(Number(numSellTokens || "0") * 10 ** sellToken.decimals)
          : BigInt(Number(numBuyTokens || "0") * 10 ** buyToken.decimals),
      mode,
    }),
    [sellToken, buyToken, mode, numSellTokens, numBuyTokens],
  );

  return (
    <div className="flex flex-col gap-20">
      <hr className="block bg-primary" />
      <SellToken token={sellToken} onChange={setNumSellTokens} />
      <BuyToken token={buyToken} onChange={setNumBuyTokens} />
      <hr className="block bg-primary" />
      <BumpChart history={quoteHistory} />
      <hr className="block bg-primary" />
      <LineItems />
      <hr className="block bg-primary" />
      <SwapButton swapParams={swapParams} />
    </div>
  );
}
