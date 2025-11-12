import type { Quote, QuoteSelectionFn, QuoteSelectionStrategy, SuccessfulQuote } from "./types.js";

async function onlySuccess(quotes: Array<Promise<Quote>>): Promise<SuccessfulQuote[]> {
  return (await Promise.all(quotes)).filter((q) => q.success) as SuccessfulQuote[];
}

const quotedPrice: QuoteSelectionFn = async (
  quotes: Array<Promise<Quote>>,
): Promise<SuccessfulQuote | null> => {
  const successfulQuotes = await onlySuccess(quotes);
  if (successfulQuotes.length === 0) {
    return null;
  }
  // Consider ratio for input vs output amounts
  return successfulQuotes.reduce((prev, curr) =>
    prev.outputAmount > curr.outputAmount ? prev : curr,
  );
};

const quotedGas: QuoteSelectionFn = async (
  quotes: Array<Promise<Quote>>,
): Promise<SuccessfulQuote | null> => {
  const successfulQuotes = await onlySuccess(quotes);
  if (successfulQuotes.length === 0) {
    return null;
  }
  return successfulQuotes.reduce((prev, curr) => (prev.networkFee < curr.networkFee ? prev : curr));
};

const priority: QuoteSelectionFn = async (
  quotes: Array<Promise<Quote>>,
): Promise<SuccessfulQuote | null> => {
  for (const quotePromise of quotes) {
    const quote = await quotePromise;
    if (quote.success) {
      return quote;
    }
  }
  return null;
};

// Should probably return errors otherwise
const fastest: QuoteSelectionFn = async (
  quotes: Array<Promise<Quote>>,
): Promise<SuccessfulQuote | null> => {
  return Promise.any(
    quotes.map(async (q) => {
      const resolved = await q;
      if (resolved.success) {
        return resolved;
      }
      return Promise.reject("Failed quote");
    }),
  ).catch(() => null);
};

export async function applyStrategy(
  strategy: QuoteSelectionStrategy,
  quotes: Array<Promise<Quote>>,
): Promise<SuccessfulQuote | null> {
  if (quotes.length === 0) {
    throw new Error("No quotes provided to applyStrategy");
  }

  if (typeof strategy === "function") {
    return strategy(quotes);
  }

  switch (strategy) {
    case "fastest":
      return fastest(quotes);
    case "quotedPrice":
      return quotedPrice(quotes);
    case "quotedGas":
      return quotedGas(quotes);
    case "priority":
      return priority(quotes);
  }
}
