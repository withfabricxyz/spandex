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

function priorityScore(quote: SuccessfulSimulatedQuote): number {
  return quote.activatedFeatures?.length ?? 0;
}

function withPriority(sort: SimulatedQuoteSort): SimulatedQuoteSort {
  return (a, b) => {
    const scoreA = priorityScore(a);
    const scoreB = priorityScore(b);
    if (scoreA !== scoreB) {
      return scoreA > scoreB ? -1 : 1;
    }
    return sort(a, b);
  };
}

const sortByGasUsed: SimulatedQuoteSort = (a, b) => {
  const gasA = gasCost(a);
  const gasB = gasCost(b);
  if (gasA === gasB) return 0;
  return gasA > gasB ? 1 : -1;
};

function gasCost(quote: SuccessfulSimulatedQuote): bigint {
  return quote.simulation.gasUsed ?? 0n;
}

const quotedPrice: QuoteSelectionFn = async (
  quotes: Array<Promise<SimulatedQuote>>,
): Promise<SuccessfulSimulatedQuote | null> => {
  const sorted = await resolveSuccessfulSimulatedQuotes({
    quotes,
    sort: withPriority(sortBySimulatedOutput),
  });
  return sorted[0] ?? null;
};

const quotedGas: QuoteSelectionFn = async (
  quotes: Array<Promise<SimulatedQuote>>,
): Promise<SuccessfulSimulatedQuote | null> => {
  const sorted = await resolveSuccessfulSimulatedQuotes({
    quotes,
    sort: withPriority(sortByGasUsed),
  });
  return sorted[0] ?? null;
};

const priority: QuoteSelectionFn = async (
  quotes: Array<Promise<SimulatedQuote>>,
): Promise<SuccessfulSimulatedQuote | null> => {
  const sorted = await resolveSuccessfulSimulatedQuotes({
    quotes,
    sort: withPriority(sortBySimulatedOutput),
  });
  return sorted[0] ?? null;
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

/**
 * Selects a winning quote from a set of simulated quote promises.
 *
 * @param params - Selection parameters.
 * @param params.strategy - Strategy name or custom selector function.
 * @param params.quotes - Simulated quote promises to evaluate.
 * @returns The winning successful quote, or `null` when no quote succeeds.
 */
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
