import type { SimulatedQuote } from "@withfabric/spandex";
import type { TokenMetadata } from "@/services/tokens";
import {
  getQuoteFees,
  getQuoteInaccuracy,
  getQuotePriceImpact,
  getSimulationFailureReason,
} from "@/utils/quoteHelpers";
import { formatTokenValue } from "@/utils/strings";
import { Skeleton } from "../Skeleton";
import { COLORS } from "./BumpChart";

export function LineItems({
  quote,
  inputToken,
  outputToken,
  currentAllowance,
}: {
  quote?: SimulatedQuote;
  inputToken: TokenMetadata;
  outputToken: TokenMetadata;
  currentAllowance?: bigint;
}) {
  const simulationFailure = quote ? getSimulationFailureReason(quote, currentAllowance) : null;

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
    label: string;
    value: string | null;
    color?: string;
  }[] = [
    {
      label: "Winning Aggregator",
      value: quote ? quote.provider : null,
      color: quote ? COLORS[quote.provider.toLowerCase()] : undefined,
    },
    {
      label: "Latency",
      value: quote?.success ? `${quote.latency.toFixed(1)}ms` : null,
    },
    {
      label: "Inaccuracy",
      value: getInaccuracyValue(),
    },
    {
      label: "Price",
      value: quote?.success
        ? `1 ${inputToken.symbol} = ${formatTokenValue(
            (quote.outputAmount * BigInt(10 ** inputToken.decimals)) / quote.inputAmount,
            outputToken.decimals,
          )} ${outputToken.symbol}`
        : null,
    },
    {
      label: "Gas",
      value: quote?.success ? `$${(Number(quote.networkFee) / 1e18).toFixed(2)}` : null,
    },
    {
      label: "Max Slippage",
      value: quote ? "—" : null,
    },
    {
      label: "Price Impact",
      value: getPriceImpactValue(),
    },
    {
      label: "Fee",
      value: getFeesValue(),
    },
    {
      label: "Total",
      value: quote?.success
        ? `${formatTokenValue(BigInt(quote.outputAmount), outputToken.decimals)} ${outputToken.symbol}`
        : null,
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex justify-between${i === items.length - 1 ? " font-bold" : ""}`}
        >
          <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">{item.label}</span>
          {item.value ? (
            item.color ? (
              <span
                className="font-['Sohne_Mono'] text-[12px] capitalize"
                style={{ color: item.color }}
              >
                {item.value}
              </span>
            ) : (
              <span className="font-['Sohne_Mono'] text-[12px] text-primary">{item.value}</span>
            )
          ) : (
            <Skeleton height={12} width={40} />
          )}
        </div>
      ))}
    </div>
  );
}
