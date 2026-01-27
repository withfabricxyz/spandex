import type { SimulatedQuote } from "@spandex/core";

export type Metric = "price" | "accuracy" | "latency";

// TODO: how should we do this? re: generic quote details
function isFabricQuote(
  quote: SimulatedQuote,
): quote is Extract<SimulatedQuote, { provider: "fabric" }> {
  return quote.success && quote.provider === "fabric";
}

function isOdosQuote(
  quote: SimulatedQuote,
): quote is Extract<SimulatedQuote, { provider: "odos" }> {
  return quote.success && quote.provider === "odos";
}

function getBestQuoteByPrice(quotes: SimulatedQuote[]): SimulatedQuote | undefined {
  const successfulQuotes = quotes.filter((quote) => quote.success);
  if (successfulQuotes.length === 0) return undefined;

  return successfulQuotes.reduce((best, current) => {
    return BigInt(current.outputAmount) > BigInt(best.outputAmount) ? current : best;
  });
}

function getBestQuoteByAccuracy(quotes: SimulatedQuote[]): SimulatedQuote | undefined {
  return getBestQuoteByPrice(quotes); // TODO: temp
}

function getBestQuoteByLatency(quotes: SimulatedQuote[]): SimulatedQuote | undefined {
  return getBestQuoteByPrice(quotes); // TODO: temp
}

// TODO: spandex
export function getBestQuoteByMetric({
  quotes,
  metric,
}: {
  quotes?: SimulatedQuote[];
  metric: Metric;
}): SimulatedQuote | undefined {
  if (!quotes || quotes.length === 0) return undefined;

  const bestQuoteByMetric = {
    price: getBestQuoteByPrice,
    accuracy: getBestQuoteByAccuracy,
    latency: getBestQuoteByLatency,
  };

  return bestQuoteByMetric[metric](quotes);
}

// TODO: which other aggregators surface fees?
export function getQuoteFees(quote?: SimulatedQuote): bigint | null {
  if (!quote?.success) return null;

  if (isFabricQuote(quote) && quote.details.fees?.length > 0) {
    return quote.details.fees.reduce((sum, fee) => sum + BigInt(fee.amount), 0n);
  }

  return quote.networkFee ? BigInt(quote.networkFee) : 0n;
}

function getQuotedVsSimulated(quote: SimulatedQuote): {
  quotedOutput: number;
  simulatedOutput: number;
} | null {
  if (!quote.success || !quote.simulation.success) return null;

  const quotedOutput = Number(quote.outputAmount);
  const simulatedOutput = Number(quote.simulation.outputAmount);

  if (quotedOutput === 0) return null;

  return { quotedOutput, simulatedOutput };
}

// spot price, ratio of tokens
// price impact = current spot vs known spot after trade
export function getQuotePriceImpact(quote?: SimulatedQuote): number | null {
  if (!quote?.success) return null;

  // use provider-supplied price impact if available
  if (isFabricQuote(quote)) {
    return quote.details.price;
  } else if (isOdosQuote(quote)) {
    return quote.details.priceImpact;
  }

  return null;
}

export function getQuoteInaccuracy(quote?: SimulatedQuote): number | null {
  if (!quote?.success) return null;

  const outputs = getQuotedVsSimulated(quote);

  if (!outputs) return null;

  const { quotedOutput, simulatedOutput } = outputs;
  const diff = Math.abs(simulatedOutput - quotedOutput);

  return Math.round((diff / quotedOutput) * 10000);
}

export function getSimulationFailureReason(
  quote: SimulatedQuote,
  currentAllowance?: bigint,
): string | null {
  if (!quote.success || quote.simulation.success) return null;

  const errorMessage = quote.simulation.error.message.toLowerCase();

  if (errorMessage.includes("transfer_from_failed") || errorMessage.includes("transferfrom")) {
    if (currentAllowance !== undefined && quote.inputAmount > currentAllowance) {
      return "Insufficient allowance";
    }

    return "Insufficient balance";
  }

  // TODO: other errors

  return "Simulation failed";
}
