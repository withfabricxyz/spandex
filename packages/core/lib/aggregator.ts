import { type Address, type SwapParams, type TimedQuote, type QuoteDetail, QuoteError } from "./types";

export abstract class Aggregator {
  abstract fetchQuote(params: SwapParams): Promise<QuoteDetail>;
  abstract name(): string;

  async fetchQuoteTimed(params: SwapParams): Promise<TimedQuote> {
    try {
      const start = performance.now();
      const quote = await this.fetchQuote(params);
      const stop = performance.now();
      return {
        success: true,
        provider: this.name(),
        latency: stop - start,
        quote,
      };
    } catch (error) {
      return {
        success: false,
        provider: this.name(),
        error: error as Error,
      };
    }
  }
}

export class MetaAggregator {
  constructor(private aggregators: Aggregator[]) {}

  get providers(): string[] {
    return this.aggregators.map((a) => a.name());
  }

  async fetchQuotes(params: SwapParams): Promise<TimedQuote[]> {
    const quotes = await this.getQuotes(params);
    return quotes.filter((q) => q.success).sort((a, b) => {
      return Number(b.quote.outputAmount - a.quote.outputAmount);
    });
  }

  private async getQuotes(params: SwapParams): Promise<TimedQuote[]> {
    return Promise.all(
      this.aggregators.map(async (aggregator) => {
        return aggregator.fetchQuoteTimed(params);
      }),
    );
  }
}
