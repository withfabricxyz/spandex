import type { SimulatedQuote } from "@withfabric/spandex";
import { useEffect, useState } from "react";
import type { TokenMetadata } from "@/services/tokens";
import { BumpChart } from "./BumpChart";
import { LineItems } from "./LineItems";

export type Metric = "price" | "accuracy" | "latency";

export function Insights({
  quotes,
  sellToken,
  buyToken,
  numSellTokens,
  selectedMetric,
  setSelectedMetric,
}: {
  quotes: SimulatedQuote[] | undefined;
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  numSellTokens: string;
  selectedMetric: Metric;
  setSelectedMetric: (metric: Metric) => void;
}) {
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

  // TODO: select best quote
  const latestQuotes = quoteHistory.length > 0 ? quoteHistory[quoteHistory.length - 1] : [];

  return (
    <>
      <BumpChart
        quotes={quotes}
        sellToken={sellToken}
        buyToken={buyToken}
        numSellTokens={numSellTokens}
        selectedMetric={selectedMetric}
        setSelectedMetric={setSelectedMetric}
      />
      <hr className="block bg-primary" />
      <LineItems quote={latestQuotes[0]} inputToken={sellToken} outputToken={buyToken} />
    </>
  );
}
