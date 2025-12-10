import type { FabricQuoteResponse } from "../lib/aggregators/fabric.js";
import { Aggregator } from "../lib/aggregators/index.js";
import type {
  AggregatorFeature,
  AggregatorMetadata,
  ProviderKey,
  Quote,
  SuccessfulQuote,
  SwapParams,
} from "../lib/types.js";

export const defaultSwapParams: SwapParams = {
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
  mode: "exactIn",
};

export const quoteSuccess: SuccessfulQuote = {
  success: true,
  provider: "fabric",
  details: {} as FabricQuoteResponse,
  latency: 100,
  inputAmount: 1_000_000n,
  outputAmount: 900_000n,
  networkFee: 5_000n,
  txData: { to: "0x0", data: "0x0" },
};

export const quoteFailure: Quote = {
  success: false,
  provider: "fabric",
  error: new Error("Failed to get quote"),
};

export type MockOverrides = {
  delay?: number;
  features?: AggregatorFeature[];
};

export class MockAggregator extends Aggregator {
  override metadata(): AggregatorMetadata {
    return {
      name: "MockAggregator",
      url: "https://example.com",
      docsUrl: "https://example.com/docs",
    };
  }
  private counter = 0;
  constructor(
    private readonly quote: Quote,
    private readonly overrides: MockOverrides = {},
  ) {
    super();
  }

  get count() {
    return this.counter;
  }

  name(): ProviderKey {
    return this.quote.provider;
  }

  override features(): AggregatorFeature[] {
    return this.overrides.features || ["exactIn"];
  }

  async tryFetchQuote(_: SwapParams): Promise<SuccessfulQuote> {
    this.counter++;
    if (this.overrides.delay) {
      await new Promise((resolve) => setTimeout(resolve, this.overrides.delay));
    }

    if (!this.quote.success) {
      throw new Error("Failed to fetch quote");
    }
    return this.quote as SuccessfulQuote;
  }
}
