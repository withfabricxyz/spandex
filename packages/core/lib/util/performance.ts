import type { QuotePerformance, SuccessfulSimulatedQuote } from "../types.js";

/**
 * Sorts successful simulated quotes by a specified performance metric.
 *
 * @param params - Sorting parameters.
 * @param params.quotes - Quotes to sort.
 * @param params.metric - Performance metric to sort by.
 * @param params.ascending - Whether to sort in ascending order (default: true).
 * @returns Quotes sorted by the specified performance metric.
 */
export function sortQuotesByPerformance({
  quotes,
  metric,
  ascending = true,
}: {
  quotes: SuccessfulSimulatedQuote[];
  metric: keyof QuotePerformance;
  ascending?: boolean;
}): SuccessfulSimulatedQuote[] {
  return [...quotes].sort((a, b) => {
    const aValue = a.performance[metric];
    const bValue = b.performance[metric];
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return ascending ? 1 : -1;
    if (bValue === undefined) return ascending ? -1 : 1;
    if (aValue < bValue) return ascending ? -1 : 1;
    if (aValue > bValue) return ascending ? 1 : -1;
    return 0;
  });
}
