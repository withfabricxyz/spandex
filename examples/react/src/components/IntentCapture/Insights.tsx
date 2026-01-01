import type { SimulatedQuote } from "@withfabric/spandex";
import { useEffect, useState } from "react";
import type { TokenMetadata } from "@/services/tokens";
import type { Metric } from "@/utils/quoteHelpers";
import { BumpChart } from "./BumpChart";
import { LineItems } from "./LineItems";

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
  currentAllowance?: bigint;
};

export function Insights({
  bestQuote,
  quotes,
  sellToken,
  buyToken,
  numSellTokens,
  selectedMetric,
  setSelectedMetric,
  slippageBps,
  setSlippageBps,
  currentAllowance,
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

  return (
    <>
      <BumpChart
        quoteHistory={quoteHistory}
        selectedMetric={selectedMetric}
        setSelectedMetric={setSelectedMetric}
      />
      <hr className="block bg-primary" />
      <LineItems
        quote={bestQuote}
        quotes={quotes}
        inputToken={sellToken}
        outputToken={buyToken}
        sellToken={sellToken}
        numSellTokens={numSellTokens}
        slippageBps={slippageBps}
        setSlippageBps={setSlippageBps}
        currentAllowance={currentAllowance}
      />
    </>
  );
}
