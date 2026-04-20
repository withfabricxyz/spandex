import type {
  QuoteSelectionCollector,
  QuoteSelectionCollectorSpec,
  QuoteSelectionFn,
  QuoteSelectionPlan,
  QuoteSelectionRanker,
  QuoteSelectionRankerSpec,
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

function cancelPendingQuotes(quotes: Array<Promise<SimulatedQuote>>, reason: string): void {
  const collection = quotes as Array<Promise<SimulatedQuote>> & {
    cancel?: (reason?: unknown) => void;
  };
  collection.cancel?.(new Error(reason));
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertWithinProviderCount(value: number, max: number, label: string): void {
  if (value > max) {
    throw new Error(`${label} cannot exceed the number of providers`);
  }
}

async function collectSuccessfulSimulatedQuotesUntil({
  quotes,
  shouldStop,
  stopReason,
}: {
  quotes: Array<Promise<SimulatedQuote>>;
  shouldStop: (quotes: SuccessfulSimulatedQuote[]) => boolean;
  stopReason: string;
}): Promise<SuccessfulSimulatedQuote[] | null> {
  const pending = new Set(
    quotes.map(async (quote) => {
      try {
        return await quote;
      } catch {
        return null;
      }
    }),
  );
  const successfulQuotes: SuccessfulSimulatedQuote[] = [];

  while (pending.size > 0) {
    const next = await Promise.race(
      [...pending].map(async (quote) => ({
        promise: quote,
        resolved: await quote,
      })),
    );
    pending.delete(next.promise);

    if (next.resolved && isSuccessfulSimulatedQuote(next.resolved)) {
      successfulQuotes.push(next.resolved);

      if (shouldStop(successfulQuotes)) {
        cancelPendingQuotes(quotes, stopReason);
        return successfulQuotes;
      }
    }
  }

  return null;
}

function rankQuotes(
  quotes: SuccessfulSimulatedQuote[],
  sort: SimulatedQuoteSort,
): SuccessfulSimulatedQuote | null {
  return [...quotes].sort(sort)[0] ?? null;
}

async function collectQuotes(
  quotes: Array<Promise<SimulatedQuote>>,
  collector: QuoteSelectionCollectorSpec,
): Promise<SuccessfulSimulatedQuote[] | null> {
  switch (collector.type) {
    case "all":
      return resolveSuccessfulSimulatedQuotes({ quotes });
    case "firstN": {
      assertPositiveInteger(collector.count, "Collector firstN count");
      assertWithinProviderCount(collector.count, quotes.length, "Collector firstN count");
      return collectSuccessfulSimulatedQuotesUntil({
        quotes,
        shouldStop: (successfulQuotes) => successfulQuotes.length >= collector.count,
        stopReason: `Collected first ${collector.count} successful quote(s)`,
      });
    }
    case "benchmark": {
      const minQuotes = collector.minQuotes ?? 2;
      assertPositiveInteger(minQuotes, "Collector benchmark minQuotes");
      assertWithinProviderCount(minQuotes, quotes.length, "Collector benchmark minQuotes");
      return collectSuccessfulSimulatedQuotesUntil({
        quotes,
        shouldStop: (successfulQuotes) =>
          successfulQuotes.length >= minQuotes &&
          successfulQuotes.some((quote) => quote.provider === collector.provider),
        stopReason: `Collected benchmark provider ${collector.provider}`,
      });
    }
  }
}

function rankCollectedQuotes(
  quotes: SuccessfulSimulatedQuote[],
  ranker: QuoteSelectionRankerSpec,
): SuccessfulSimulatedQuote | null {
  switch (ranker) {
    case "first":
      return quotes[0] ?? null;
    case "bestPrice":
      return rankQuotes(quotes, withPriority(sortBySimulatedOutput));
    case "estimatedGas":
      return rankQuotes(quotes, withPriority(sortByGasUsed));
    case "priority":
      return rankQuotes(quotes, withPriority(sortBySimulatedOutput));
  }
}

function isCollectorSpec(
  collector: QuoteSelectionCollector,
): collector is QuoteSelectionCollectorSpec {
  return typeof collector !== "function";
}

function isRankerSpec(ranker: QuoteSelectionRanker): ranker is QuoteSelectionRankerSpec {
  return typeof ranker !== "function";
}

function toSelectionFn(strategy: QuoteSelectionStrategy): QuoteSelectionFn {
  if (typeof strategy === "function") {
    return strategy;
  }

  const plan: QuoteSelectionPlan =
    typeof strategy === "string"
      ? strategy === "fastest"
        ? { collect: { type: "firstN", count: 1 }, rank: "first" }
        : { collect: { type: "all" }, rank: strategy }
      : strategy;

  return async (
    quotes: Array<Promise<SimulatedQuote>>,
  ): Promise<SuccessfulSimulatedQuote | null> => {
    const successfulQuotes = isCollectorSpec(plan.collect)
      ? await collectQuotes(quotes, plan.collect)
      : await plan.collect(quotes);
    if (!successfulQuotes?.length) {
      return null;
    }
    return isRankerSpec(plan.rank)
      ? rankCollectedQuotes(successfulQuotes, plan.rank)
      : plan.rank(successfulQuotes);
  };
}

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

  return toSelectionFn(strategy)(quotes);
}
