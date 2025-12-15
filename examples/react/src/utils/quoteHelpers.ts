import type { SimulatedQuote } from "@withfabric/spandex";

// TODO: how should we do this? re: generic quote details
export function isFabricQuote(
  quote: SimulatedQuote,
): quote is Extract<SimulatedQuote, { provider: "fabric" }> {
  return quote.success && quote.provider === "fabric";
}

export function isZeroXQuote(
  quote: SimulatedQuote,
): quote is Extract<SimulatedQuote, { provider: "0x" }> {
  return quote.success && quote.provider === "0x";
}

export function isKyberQuote(
  quote: SimulatedQuote,
): quote is Extract<SimulatedQuote, { provider: "kyberswap" }> {
  return quote.success && quote.provider === "kyberswap";
}

export function isOdosQuote(
  quote: SimulatedQuote,
): quote is Extract<SimulatedQuote, { provider: "odos" }> {
  return quote.success && quote.provider === "odos";
}

// TODO: which other aggregators surface fees?
export function getQuoteFees(quote: SimulatedQuote): bigint | null {
  if (!quote.success) return null;

  if (isFabricQuote(quote) && quote.details.fees?.length > 0) {
    return quote.details.fees.reduce((sum, fee) => sum + BigInt(fee.amount), 0n);
  }

  return null;
}

// TODO:
export function getQuotePriceImpact(quote: SimulatedQuote): number | null {
  if (!quote.success) return null;

  return null;
}

// TODO:
export function getQuoteSlippageData(quote: SimulatedQuote): {
  maxSlippage?: number;
  actualSlippage?: number;
} | null {
  if (!quote.success) return null;

  return null;
}

export function getQuoteInaccuracy(quote: SimulatedQuote): number | null {
  if (!quote.success || !quote.simulation.success) return null;

  const quotedOutput = Number(quote.outputAmount);
  const simulatedOutput = Number(quote.simulation.outputAmount);

  if (quotedOutput === 0) return null;

  const diff = Math.abs(simulatedOutput - quotedOutput);
  return Math.round((diff / quotedOutput) * 10000);
}

export function getQuotePositiveSlippage(quote: SimulatedQuote): {
  percentage: number;
  diff: number;
} | null {
  if (!quote.success || !quote.simulation.success) return null;

  const quotedOutput = Number(quote.outputAmount);
  const simulatedOutput = Number(quote.simulation.outputAmount);

  if (simulatedOutput <= quotedOutput) return null;

  const diff = simulatedOutput - quotedOutput;
  const percentage = (diff / quotedOutput) * 100;

  return { percentage, diff };
}
