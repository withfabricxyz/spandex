import type {
  QuoteSelectionFn,
  QuoteSelectionStrategy,
  SimulatedQuote,
  SimulatedQuoteSort,
  SuccessfulSimulatedQuote,
} from "./types.js";

function isSuccessfulSimulatedQuote(quote: SimulatedQuote): quote is SuccessfulSimulatedQuote {
  return quote.success && quote.simulation.success;
}

async function resolveSuccessfulSimulatedQuotes({
  quotes,
  sort,
}: {
  quotes: Array<Promise<SimulatedQuote>>;
  sort?: SimulatedQuoteSort;
}): Promise<SuccessfulSimulatedQuote[]> {
  const successfulQuotes = (await Promise.all(quotes)).filter(isSuccessfulSimulatedQuote);
  if (!sort) {
    return successfulQuotes;
  }
  return [...successfulQuotes].sort(sort);
}

const sortBySimulatedOutput: SimulatedQuoteSort = (a, b) => {
  if (a.simulation.outputAmount === b.simulation.outputAmount) return 0;
  return a.simulation.outputAmount > b.simulation.outputAmount ? -1 : 1;
};

const sortByGasUsed: SimulatedQuoteSort = (a, b) => {
  const gasA = gasCost(a);
  const gasB = gasCost(b);
  if (gasA === gasB) return 0;
  return gasA > gasB ? 1 : -1;
};

function gasCost(quote: SuccessfulSimulatedQuote): bigint {
  return quote.simulation.gasUsed ?? quote.networkFee;
}

const quotedPrice: QuoteSelectionFn = async (
  quotes: Array<Promise<SimulatedQuote>>,
): Promise<SuccessfulSimulatedQuote | null> => {
  const sorted = await resolveSuccessfulSimulatedQuotes({
    quotes,
    sort: sortBySimulatedOutput,
  });
  return sorted[0] ?? null;
};

const quotedGas: QuoteSelectionFn = async (
  quotes: Array<Promise<SimulatedQuote>>,
): Promise<SuccessfulSimulatedQuote | null> => {
  const sorted = await resolveSuccessfulSimulatedQuotes({
    quotes,
    sort: sortByGasUsed,
  });
  return sorted[0] ?? null;
};

const priority: QuoteSelectionFn = async (
  quotes: Array<Promise<SimulatedQuote>>,
): Promise<SuccessfulSimulatedQuote | null> => {
  for (const quotePromise of quotes) {
    const quote = await quotePromise;
    if (isSuccessfulSimulatedQuote(quote)) {
      return quote;
    }
  }
  return null;
};

const fastest: QuoteSelectionFn = async (
  quotes: Array<Promise<SimulatedQuote>>,
): Promise<SuccessfulSimulatedQuote | null> => {
  return Promise.any(
    quotes.map(async (q) => {
      const resolved = await q;
      if (isSuccessfulSimulatedQuote(resolved)) {
        return resolved;
      }
      return Promise.reject("Failed quote simulation");
    }),
  ).catch(() => null);
};

export async function selectQuote({
  strategy,
  quotes,
}: {
  strategy: QuoteSelectionStrategy;
  quotes: Array<Promise<SimulatedQuote>>;
}): Promise<SuccessfulSimulatedQuote | null> {
  if (quotes.length === 0) {
    throw new Error("No quotes provided to selectQuote");
  }

  if (typeof strategy === "function") {
    return strategy(quotes);
  }

  switch (strategy) {
    case "fastest":
      return fastest(quotes);
    case "bestPrice":
      return quotedPrice(quotes);
    case "estimatedGas":
      return quotedGas(quotes);
    case "priority":
      return priority(quotes);
  }
}
