import type { SimulatedQuote } from "@spandex/core";
import { useEffect, useMemo, useState } from "react";
import type { TokenMetadata } from "@/services/tokens";
import type { SwapErrorState } from "@/utils/errors";
import { getMetricWinner, type Metric } from "@/utils/quoteHelpers";
import { BumpChart } from "./BumpChart";
import { LineItems } from "./LineItems";
import { QuoteRefreshCountdown } from "./QuoteRefreshCountdown";

type InsightsProps = {
  bestQuote: SimulatedQuote | undefined;
  quotes: SimulatedQuote[] | undefined;
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  numSellTokens: string;
  selectedMetric: Metric;
  setSelectedMetric: (metric: Metric) => void;
  slippageBps: number;
  setSlippageBps: (value: number) => void;
  errors?: SwapErrorState;
  isFetching: boolean;
  dataUpdatedAt: number;
  refreshIntervalMs: number;
};

type QuoteDataViewProps = InsightsProps & {
  quoteHistory: SimulatedQuote[][];
  metricWinner: string | undefined;
};

function QuoteDataView({
  quoteHistory,
  bestQuote,
  quotes,
  sellToken,
  buyToken,
  numSellTokens,
  selectedMetric,
  setSelectedMetric,
  slippageBps,
  setSlippageBps,
  metricWinner,
  errors,
  isFetching,
  dataUpdatedAt,
  refreshIntervalMs,
}: QuoteDataViewProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <BumpChart
          quoteHistory={quoteHistory}
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
          errors={errors}
        />
        <QuoteRefreshCountdown
          enabled={true}
          fetching={isFetching}
          updatedAt={dataUpdatedAt}
          durationMs={refreshIntervalMs}
        />
      </div>

      <hr className="border-primary" />
      <LineItems
        quote={bestQuote}
        quotes={quotes}
        sellToken={sellToken}
        buyToken={buyToken}
        numSellTokens={numSellTokens}
        slippageBps={slippageBps}
        setSlippageBps={setSlippageBps}
        metricWinner={metricWinner}
        errors={errors}
      />
    </>
  );
}

// handles quoteHistory state and shares with BumpChart and LineItems
function QuoteHistoryWrapper({
  bestQuote,
  quotes,
  sellToken,
  buyToken,
  numSellTokens,
  selectedMetric,
  setSelectedMetric,
  slippageBps,
  setSlippageBps,
  errors,
  isFetching,
  dataUpdatedAt,
  refreshIntervalMs,
}: InsightsProps) {
  const [quoteHistory, setQuoteHistory] = useState<SimulatedQuote[][]>([]);

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

  // compute the winner from the most recent quote snapshot
  const metricWinner = useMemo(() => {
    const latestSnapshot = quoteHistory[quoteHistory.length - 1];
    if (!latestSnapshot) return undefined;
    return getMetricWinner(latestSnapshot, selectedMetric);
  }, [quoteHistory, selectedMetric]);

  return (
    <QuoteDataView
      quoteHistory={quoteHistory}
      selectedMetric={selectedMetric}
      setSelectedMetric={setSelectedMetric}
      bestQuote={bestQuote}
      quotes={quotes}
      sellToken={sellToken}
      buyToken={buyToken}
      numSellTokens={numSellTokens}
      slippageBps={slippageBps}
      setSlippageBps={setSlippageBps}
      metricWinner={metricWinner}
      errors={errors}
      isFetching={isFetching}
      dataUpdatedAt={dataUpdatedAt}
      refreshIntervalMs={refreshIntervalMs}
    />
  );
}

export { QuoteHistoryWrapper as Insights };
