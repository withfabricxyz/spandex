import type { PublicClient } from "viem";
import { simulateSwap } from "./simulation";
import type {
  ProviderKey,
  Quote,
  QuoteError,
  SimulatedQuoteResult,
  SuccessfulQuote,
  SwapParams,
} from "./types";

type AnyPublicClient = Pick<PublicClient, "request" | "readContract">;

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
  constructor(
    private aggregators: Aggregator[],
    private client: AnyPublicClient,
  ) {}

  get providers(): string[] {
    return this.aggregators.map((a) => a.name());
  }

  async fetchQuotes(params: SwapParams): Promise<SimulatedQuoteResult[]> {
    const quotes = await this.getQuotes(params);
    const successfulQuotes = quotes.filter((q) => q.success) as SuccessfulQuote[];
    const client = this.client;

    const simulatedQuotes = await Promise.all(
      successfulQuotes.map(async (quote) => {
        const simulation = await simulateSwap(client, {
          from: params.swapperAccount,
          to: quote.txData.to,
          data: quote.txData.data,
          value: quote.txData.value,
          tokenIn: params.inputToken,
          tokenOut: params.outputToken,
          amountIn: params.inputAmount,
        });

        return {
          ...quote,
          simulation,
        };
      }),
    );

    return simulatedQuotes
      .filter((q) => q.simulation.success)
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
