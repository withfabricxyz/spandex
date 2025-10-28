import type { ProviderKey, Quote, QuoteError, SuccessfulQuote, SwapParams } from "./types";

export abstract class Aggregator {
  abstract fetchQuote(params: SwapParams): Promise<SuccessfulQuote>;
  abstract name(): ProviderKey;

  async fetchQuoteTimed(params: SwapParams): Promise<Quote> {
    try {
      const start = performance.now();
      const quote = await this.fetchQuote(params);
      const stop = performance.now();
      return {
        ...quote,
        latency: stop - start,
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name(),
        error: error as QuoteError,
      };
    }
  }
}

export class MetaAggregator {
  constructor(private aggregators: Aggregator[]) {}

  get providers(): string[] {
    return this.aggregators.map((a) => a.name());
  }

  async fetchQuotes(params: SwapParams): Promise<Quote[]> {
    const quotes = await this.getQuotes(params);
    return quotes
      .filter((q) => q.success)
      .sort((a, b) => {
        return Number(b.outputAmount - a.outputAmount);
      });
  }

  private async getQuotes(params: SwapParams): Promise<Quote[]> {
    return Promise.all(
      this.aggregators.map(async (aggregator) => {
        return aggregator.fetchQuoteTimed(params);
      }),
    );
  }
}
