import type { SimulatedQuote, SuccessfulQuote } from "@spandex/core";
import type { JSX } from "react";
import type { TokenMetadata } from "@/services/tokens";
import type { SwapErrorState } from "@/utils/errors";
import { getQuoteFees, getQuoteInaccuracy, getQuotePriceImpact } from "@/utils/quoteHelpers";
import { formatTokenValue } from "@/utils/strings";
import { Skeleton } from "../../Skeleton";
import { SlippageControls } from "../SlippageControls";
import { COLORS } from "./BumpChart";
import {
  GasTooltip,
  InaccuracyTooltip,
  LatencyTooltip,
  MaxSlippageTooltip,
  PriceImpactTooltip,
  PriceTooltip,
} from "./Tooltips";

type LineItemsProps = {
  quote?: SimulatedQuote;
  quotes?: SimulatedQuote[];
  sellToken: TokenMetadata;
  buyToken: TokenMetadata;
  numSellTokens: string;
  slippageBps: number;
  setSlippageBps: (value: number) => void;
  metricWinner?: string;
  isFetchingQuotes: boolean;
  errors?: SwapErrorState;
};

function FetchingFallback({
  isFetchingQuotes,
  value,
}: {
  isFetchingQuotes: boolean;
  value?: JSX.Element | string | null;
}) {
  if (value) return value;
  return isFetchingQuotes ? <Skeleton height={12} width={50} /> : "N/A";
}

export function LineItems({
  quote,
  quotes,
  buyToken,
  sellToken,
  numSellTokens,
  slippageBps,
  setSlippageBps,
  metricWinner,
  isFetchingQuotes,
  errors,
}: LineItemsProps) {
  const successfulQuotes: SuccessfulQuote[] = quotes?.filter((q) => q.success) || [];

  const hasErrors = !!(errors?.input.length || errors?.quote.length);
  const simulationError = errors?.simulation?.find((e) => e.cause === "simulation")?.title;
  const quoteInaccuracy = getQuoteInaccuracy(quote);
  const priceImpact = getQuotePriceImpact(quote);
  const quoteFees = getQuoteFees(quote);

  const items: {
    label: JSX.Element | string;
    value: JSX.Element | string | null;
    color?: string;
  }[] = [
    {
      label: "Winning Aggregator",
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={!hasErrors && metricWinner ? metricWinner : null}
        />
      ),
      color: !hasErrors && metricWinner ? COLORS[metricWinner.toLowerCase()] : undefined,
    },
    {
      label: <LatencyTooltip successfulQuotes={successfulQuotes} />,
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={quote?.success ? `${quote.latency.toFixed(1)}ms` : null}
        />
      ),
    },
    {
      label: <InaccuracyTooltip successfulQuotes={successfulQuotes} />,
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={
            quoteInaccuracy !== null
              ? `${quoteInaccuracy / 100} bps`
              : simulationError || (errors?.simulation?.length ? "Simulation failed" : null)
          }
        />
      ),
    },
    {
      label: (
        <PriceTooltip
          successfulQuotes={successfulQuotes}
          sellToken={sellToken}
          buyToken={buyToken}
        />
      ),
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={
            quote?.success
              ? `1 ${sellToken.symbol} = ${formatTokenValue(
                  (quote.outputAmount * BigInt(10 ** sellToken.decimals)) / quote.inputAmount,
                  buyToken.decimals,
                )} ${buyToken.symbol}`
              : null
          }
        />
      ),
    },
    {
      label: <GasTooltip />,
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={quote?.success ? `$${(Number(quote.networkFee) / 1e18).toFixed(2)}` : null}
        />
      ),
    },
    {
      label: <MaxSlippageTooltip />,
      value: (
        <SlippageControls
          sellToken={sellToken}
          numSellTokens={numSellTokens}
          slippageBps={slippageBps}
          setSlippageBps={setSlippageBps}
        />
      ),
    },
    {
      label: <PriceImpactTooltip />,
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={priceImpact !== null ? `${priceImpact.toFixed(2)}%` : null}
        />
      ),
    },
    {
      label: "Fee",
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={quoteFees !== null ? `$${(Number(quoteFees) / 1e18).toFixed(2)}` : null}
        />
      ),
    },
    {
      label: "Total",
      value: (
        <FetchingFallback
          isFetchingQuotes={isFetchingQuotes}
          value={
            quote?.success
              ? `${formatTokenValue(BigInt(quote.outputAmount), buyToken.decimals)} ${buyToken.symbol}`
              : null
          }
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      {items.map((item, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: <>
          key={i}
          className={`flex justify-between${i === items.length - 1 ? " font-bold" : ""}`}
        >
          <span className="text-primary monospace text-[12px] text-secondary-1">{item.label}</span>
          {item.color ? (
            <span className="monospace text-[12px] capitalize" style={{ color: item.color }}>
              {item.value}
            </span>
          ) : (
            <span className="monospace text-[12px] text-primary">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
