import type { QuotePerformance, SuccessfulSimulatedQuote } from "../types.js";

/**
 * Sort an array of successful simulated quotes based on a specified performance metric.
 * @param quotes The array of successful simulated quotes to sort
 * @param metric The metric to sort by (e.g., 'latency', 'gasUsed', 'outputAmount', 'accuracy')
 * @param ascending Whether to sort in ascending order (default: true)
 * @returns An array of quotes sorted by the specified performance metric
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
