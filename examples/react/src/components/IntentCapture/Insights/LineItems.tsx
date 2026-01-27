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
  errors?: SwapErrorState;
};

export function LineItems({
  quote,
  quotes,
  buyToken,
  sellToken,
  numSellTokens,
  slippageBps,
  setSlippageBps,
  errors,
}: LineItemsProps) {
  const successfulQuotes: SuccessfulQuote[] = quotes?.filter((q) => q.success) || [];

  const getInaccuracyValue = () => {
    const quoteInaccuracy = getQuoteInaccuracy(quote);

    if (errors?.simulation) return errors.simulation.title;
    if (quoteInaccuracy !== null) return `${quoteInaccuracy / 100} bps`;

    return "N/A";
  };

  const getPriceImpactValue = () => {
    const priceImpact = getQuotePriceImpact(quote);

    if (priceImpact !== null) return `${priceImpact.toFixed(2)}%`;

    return "N/A";
  };

  const getFeesValue = () => {
    const quoteFees = getQuoteFees(quote);

    if (quoteFees !== null) return `$${(Number(quoteFees) / 1e18).toFixed(2)}`;

    return "N/A";
  };

  const items: {
    label: JSX.Element | string;
    value: JSX.Element | string | null;
    color?: string;
  }[] = [
    {
      label: "Winning Aggregator",
      value: quote ? quote.provider : "N/A",
      color: quote ? COLORS[quote.provider.toLowerCase()] : undefined,
    },
    {
      label: <LatencyTooltip successfulQuotes={successfulQuotes} />,
      value: quote?.success ? `${quote.latency.toFixed(1)}ms` : "N/A",
    },
    {
      label: <InaccuracyTooltip successfulQuotes={successfulQuotes} />,
      value: getInaccuracyValue(),
    },
    {
      label: (
        <PriceTooltip
          successfulQuotes={successfulQuotes}
          sellToken={sellToken}
          buyToken={buyToken}
        />
      ),
      value: quote?.success
        ? `1 ${sellToken.symbol} = ${formatTokenValue(
            (quote.outputAmount * BigInt(10 ** sellToken.decimals)) / quote.inputAmount,
            buyToken.decimals,
          )} ${buyToken.symbol}`
        : "N/A",
    },
    {
      label: <GasTooltip />,
      value: quote?.success ? `$${(Number(quote.networkFee) / 1e18).toFixed(2)}` : "N/A",
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
      value: getPriceImpactValue(),
    },
    {
      label: "Fee",
      value: getFeesValue(),
    },
    {
      label: "Total",
      value: quote?.success
        ? `${formatTokenValue(BigInt(quote.outputAmount), buyToken.decimals)} ${buyToken.symbol}`
        : "N/A",
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
          {item.value ? (
            item.color ? (
              <span className="monospace text-[12px] capitalize" style={{ color: item.color }}>
                {item.value}
              </span>
            ) : (
              <span className="monospace text-[12px] text-primary">{item.value}</span>
            )
          ) : (
            <Skeleton height={12} width={40} />
          )}
        </div>
      ))}
    </div>
  );
}
