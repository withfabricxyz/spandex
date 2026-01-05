import type { SimulatedQuote } from "@withfabric/spandex";
import type { JSX } from "react";
import type { TokenMetadata } from "@/services/tokens";
import {
  getQuoteFees,
  getQuoteInaccuracy,
  getQuotePriceImpact,
  getSimulationFailureReason,
} from "@/utils/quoteHelpers";
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
  currentAllowance?: bigint;
};

export function LineItems({
  quote,
  quotes,
  buyToken,
  sellToken,
  numSellTokens,
  slippageBps,
  setSlippageBps,
  currentAllowance,
}: LineItemsProps) {
  const simulationFailure = quote ? getSimulationFailureReason(quote, currentAllowance) : null;
  const successfulQuotes = quotes?.filter((q) => q.success) || [];

  const getInaccuracyValue = () => {
    const quoteInaccuracy = getQuoteInaccuracy(quote);

    if (simulationFailure) return simulationFailure;
    if (quoteInaccuracy !== null) return `${quoteInaccuracy / 100} bps`;
    if (quote) return "—";

    return null;
  };

  const getPriceImpactValue = () => {
    const priceImpact = getQuotePriceImpact(quote);

    if (simulationFailure) return simulationFailure;
    if (priceImpact !== null) return `${priceImpact.toFixed(2)}%`;
    if (quote) return "—";

    return null;
  };

  const getFeesValue = () => {
    const quoteFees = getQuoteFees(quote);

    if (quoteFees !== null) return `$${(Number(quoteFees) / 1e18).toFixed(2)}`;

    return "—";
  };

  const items: {
    label: JSX.Element | string;
    value: JSX.Element | string | null;
    color?: string;
  }[] = [
    {
      label: "Winning Aggregator",
      value: quote ? quote.provider : null,
      color: quote ? COLORS[quote.provider.toLowerCase()] : undefined,
    },
    {
      label: <LatencyTooltip successfulQuotes={successfulQuotes} />,
      value: quote?.success ? `${quote.latency.toFixed(1)}ms` : null,
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
        : null,
    },
    {
      label: <GasTooltip />,
      value: quote?.success ? `$${(Number(quote.networkFee) / 1e18).toFixed(2)}` : null,
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
        : null,
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
