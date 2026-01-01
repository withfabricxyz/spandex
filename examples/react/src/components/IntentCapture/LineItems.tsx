import type { SimulatedQuote } from "@withfabric/spandex";
import { Tooltip } from "radix-ui";
import type { JSX } from "react";
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
import { SlippageControls } from "./SlippageControls";

export function LineItems({
  quote,
  quotes,
  inputToken,
  outputToken,
  sellToken,
  numSellTokens,
  slippageBps,
  setSlippageBps,
  currentAllowance,
}: {
  quote?: SimulatedQuote;
  quotes?: SimulatedQuote[];
  inputToken: TokenMetadata;
  outputToken: TokenMetadata;
  sellToken: TokenMetadata;
  numSellTokens: string;
  slippageBps: number;
  setSlippageBps: (value: number) => void;
  currentAllowance?: bigint;
}) {
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
    tooltip?: boolean;
  }[] = [
    {
      label: "Winning Aggregator",
      value: quote ? quote.provider : null,
      color: quote ? COLORS[quote.provider.toLowerCase()] : undefined,
      tooltip: true,
    },
    {
      label: (
        <Tooltip.Root>
          <Tooltip.Trigger className="underline cursor-pointer decoration-dotted hover:decoration-solid">
            Latency
          </Tooltip.Trigger>
          <Tooltip.Content>
            <div className="p-10 rounded-xs max-w-[336px] flex flex-col gap-10 bg-surface-1">
              <span className="font-medium font-['Sohne_Breit'] text-[16px] text-primary">
                How long did it take to provide a quote?
              </span>
              <div className="flex monospace justify-between text-primary text-[12px]">
                <span>Aggregator</span>
                <span className="text-right">Time</span>
                <span className="text-right">Gap</span>
              </div>
              <hr className="block bg-primary" />
              {successfulQuotes
                ?.sort((a, b) => a.latency - b.latency)
                .map((q, i, sortedQuotes) => {
                  const color = COLORS[q.provider.toLowerCase()];
                  const isLast = i === sortedQuotes.length - 1;
                  const gap = isLast ? null : q.latency - sortedQuotes[i + 1].latency;

                  return (
                    <div
                      key={q.provider}
                      className="flex monospace justify-between text-primary text-[12px]"
                    >
                      <span className="capitalize" style={{ color }}>
                        {q.provider}
                      </span>
                      <span className="text-right">{`${q.latency.toFixed(1)}ms`}</span>
                      <span className="text-right">
                        {gap === null ? "--" : `${gap.toFixed(1)}ms`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Tooltip.Content>
        </Tooltip.Root>
      ),
      value: quote?.success ? `${quote.latency.toFixed(1)}ms` : null,
      tooltip: true,
    },
    {
      label: (
        <Tooltip.Root>
          <Tooltip.Trigger className="underline cursor-pointer decoration-dotted hover:decoration-solid">
            Inaccuracy
          </Tooltip.Trigger>
          <Tooltip.Content>
            <div className="p-10 rounded-xs max-w-[336px] flex flex-col gap-10 bg-surface-1">
              <span className="font-medium font-['Sohne_Breit'] text-[16px] text-primary">
                How wide was the delta between quote and execution?
              </span>
              <div className="flex monospace justify-between text-primary text-[12px]">
                <span>Aggregator</span>
                <span className="text-right">Delta</span>
                <span className="text-right">Gap</span>
              </div>
              <hr className="block bg-primary" />
              {successfulQuotes
                ?.map((q) => ({ quote: q, inaccuracy: getQuoteInaccuracy(q) }))
                .filter((item) => item.inaccuracy !== null)
                .sort((a, b) => (a.inaccuracy || 0) - (b.inaccuracy || 0))
                .map((item, i, sortedItems) => {
                  const { quote: q, inaccuracy } = item;
                  const color = COLORS[q.provider.toLowerCase()];
                  const isLast = i === sortedItems.length - 1;
                  const gap = isLast
                    ? null
                    : (sortedItems[i + 1].inaccuracy || 0) - (inaccuracy || 0);

                  return (
                    <div
                      key={q.provider}
                      className="flex monospace justify-between text-primary text-[12px]"
                    >
                      <span className="capitalize" style={{ color }}>
                        {q.provider}
                      </span>
                      <span className="text-right">{`${((inaccuracy || 0) / 100).toFixed(3)}bps`}</span>
                      <span className="text-right">
                        {gap === null ? "--" : `${(gap / 100).toFixed(3)}bps`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Tooltip.Content>
        </Tooltip.Root>
      ),
      value: getInaccuracyValue(),
      tooltip: true,
    },
    {
      label: (
        <Tooltip.Root>
          <Tooltip.Trigger className="underline cursor-pointer decoration-dotted hover:decoration-solid">
            Price
          </Tooltip.Trigger>
          <Tooltip.Content>
            <div className="p-10 rounded-xs max-w-[336px] flex flex-col gap-10 bg-surface-1">
              <span className="font-medium font-['Sohne_Breit'] text-[16px] text-primary">
                How does the token output vs input compare to peers?
              </span>
              <div className="flex monospace justify-between text-primary text-[12px]">
                <span>Aggregator</span>
                <span className="text-right">{outputToken.symbol}</span>
                <span className="text-right">Delta</span>
                <span className="text-right">Gap</span>
              </div>
              <hr className="block bg-primary" />
              {successfulQuotes
                ?.map((q) => ({
                  quote: q,
                  rate:
                    Number((q.outputAmount * BigInt(10 ** inputToken.decimals)) / q.inputAmount) /
                    10 ** outputToken.decimals,
                }))
                .sort((a, b) => b.rate - a.rate)
                .map((item, i, sortedItems) => {
                  const { quote: q, rate } = item;
                  const color = COLORS[q.provider.toLowerCase()];
                  const isLast = i === sortedItems.length - 1;
                  const baseline = sortedItems[sortedItems.length - 1].rate;
                  const delta = ((rate - baseline) / baseline) * 100;
                  const gap = isLast ? null : ((rate - sortedItems[i + 1].rate) / baseline) * 10000;

                  return (
                    <div
                      key={q.provider}
                      className="flex monospace justify-between text-primary text-[12px]"
                    >
                      <span className="capitalize" style={{ color }}>
                        {q.provider}
                      </span>
                      <span className="text-right">{rate.toFixed(8)}</span>
                      <span className="text-right">
                        {isLast ? "(Baseline)" : `${delta.toFixed(4)}%`}
                      </span>
                      <span className="text-right">
                        {gap === null ? "--" : `${gap.toFixed(1)}bps`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Tooltip.Content>
        </Tooltip.Root>
      ),
      value: quote?.success
        ? `1 ${inputToken.symbol} = ${formatTokenValue(
            (quote.outputAmount * BigInt(10 ** inputToken.decimals)) / quote.inputAmount,
            outputToken.decimals,
          )} ${outputToken.symbol}`
        : null,
      tooltip: true,
    },
    {
      label: (
        <Tooltip.Root>
          <Tooltip.Trigger className="underline cursor-pointer decoration-dotted hover:decoration-solid">
            Gas
          </Tooltip.Trigger>
          <Tooltip.Content>
            <div className="p-10 rounded-xs max-w-[336px] flex flex-col gap-10 bg-surface-1">
              <span className="monospace text-primary text-[12px]">
                The network fee required to process this transaction on-chain.
              </span>
            </div>
          </Tooltip.Content>
        </Tooltip.Root>
      ),
      value: quote?.success ? `$${(Number(quote.networkFee) / 1e18).toFixed(2)}` : null,
    },
    {
      label: (
        <Tooltip.Root>
          <Tooltip.Trigger className="underline cursor-pointer decoration-dotted hover:decoration-solid">
            Max Slippage
          </Tooltip.Trigger>
          <Tooltip.Content>
            <div className="p-10 rounded-xs max-w-[336px] flex flex-col gap-10 bg-surface-1">
              <span className="monospace text-primary text-[12px]">
                How much the price is allowed to change before your trade reverts.
              </span>
            </div>
          </Tooltip.Content>
        </Tooltip.Root>
      ),
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
      label: (
        <Tooltip.Root>
          <Tooltip.Trigger className="underline cursor-pointer decoration-dotted hover:decoration-solid">
            Price Impact
          </Tooltip.Trigger>
          <Tooltip.Content>
            <div className="p-10 rounded-xs max-w-[336px] flex flex-col gap-10 bg-surface-1">
              <span className="monospace text-primary text-[12px]">
                How much your trade moves the market price.
              </span>
            </div>
          </Tooltip.Content>
        </Tooltip.Root>
      ),
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
          // biome-ignore lint/suspicious/noArrayIndexKey: <>
          key={i}
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
