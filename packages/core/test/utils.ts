import { Aggregator } from "../lib/aggregator.js";
import type { ProviderKey, Quote, SuccessfulQuote, SwapParams } from "../lib/types.js";

export const defaultSwapParams: SwapParams = {
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
};

export class MockAggregator extends Aggregator {
  private counter = 0;
  constructor(private readonly quote: Quote) {
    super();
  }

  get count() {
    return this.counter;
  }

  name(): ProviderKey {
    return this.quote.provider;
  }

  async tryFetchQuote(_: SwapParams): Promise<SuccessfulQuote> {
    this.counter++;
    if (!this.quote.success) {
      throw new Error("Failed to fetch quote");
    }
    return this.quote as SuccessfulQuote;
  }
}
