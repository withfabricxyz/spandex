import type { SimulatedQuote } from "@withfabric/spandex";
import type { TokenMetadata } from "@/services/tokens";
import { getQuoteFees, getQuoteInaccuracy, getQuotePositiveSlippage } from "@/utils/quoteHelpers";
import { formatTokenValue } from "@/utils/strings";

function Skeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-10">
      <div className="flex justify-between">
        <div className="bg-tertiary rounded h-12 w-40" />
      </div>
    </div>
  );
}

export function LineItems({
  quote,
  inputToken,
  outputToken,
}: {
  quote?: SimulatedQuote;
  inputToken: TokenMetadata;
  outputToken: TokenMetadata;
}) {
  const derivedMetrics = quote
    ? {
        inaccuracyBps: getQuoteInaccuracy(quote),
        positiveSlippage: getQuotePositiveSlippage(quote),
        fees: getQuoteFees(quote),
      }
    : null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Winning Aggregator</span>
        {quote ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-fabric-purple">
            {quote.provider}
          </span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Latency</span>
        {quote?.simulation.success ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">
            {quote.simulation.latency.toFixed(1)}ms
          </span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Inaccuracy</span>
        {quote ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">
            {derivedMetrics?.inaccuracyBps !== null && derivedMetrics?.inaccuracyBps !== undefined
              ? `${derivedMetrics.inaccuracyBps}bps`
              : "—"}
          </span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Price</span>
        {quote?.success ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">
            1 {inputToken.symbol} ={" "}
            {formatTokenValue(
              (quote.outputAmount * BigInt(10 ** inputToken.decimals)) / quote.inputAmount,
              outputToken.decimals,
            )}{" "}
            {outputToken.symbol}
          </span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Gas</span>
        {quote?.success ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">
            ${(Number(quote.networkFee) / 1e18).toFixed(2)}
          </span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Max Slippage</span>
        {quote ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">—</span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Price Impact</span>
        {quote ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">—</span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Positive Slippage</span>
        {quote ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">
            {derivedMetrics?.positiveSlippage
              ? `${derivedMetrics.positiveSlippage.percentage.toFixed(2)}%`
              : "0%"}
          </span>
        ) : (
          <Skeleton />
        )}
      </div>
      <div className="flex justify-between">
        <span className="font-['Sohne_Mono'] text-[12px] text-secondary-1">Fee</span>
        {quote ? (
          <span className="font-['Sohne_Mono'] text-[12px] text-primary">
            {derivedMetrics?.fees !== null && derivedMetrics?.fees !== undefined
              ? `$${(Number(derivedMetrics.fees) / 1e18).toFixed(4)}`
              : "—"}
          </span>
        ) : (
          <Skeleton />
        )}
      </div>
    </div>
  );
}
