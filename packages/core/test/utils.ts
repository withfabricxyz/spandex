import { createPublicClient, http, type PublicClient } from "viem";
import { base } from "viem/chains";
import { type Config, createConfig, getQuote, getRawQuotes } from "../index.js";
import type { FabricQuoteResponse } from "../lib/aggregators/fabric.js";
import { Aggregator } from "../lib/aggregators/index.js";
import type {
  AggregatorFeature,
  AggregatorMetadata,
  ProviderKey,
  Quote,
  SuccessfulQuote,
  SuccessfulSimulatedQuote,
  SwapParams,
} from "../lib/types.js";

const ANKR_API_KEY = process.env.ANKR_API_KEY || "";
export const ETH_WHALE = "0x611f7bf868a6212f871e89f7e44684045ddfb09d";
export const USDC_WHALE = "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055";

export const defaultSwapParams: SwapParams = {
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
  mode: "exactIn",
};

export const usdcBalanceSwap: SwapParams = {
  ...defaultSwapParams,
  swapperAccount: USDC_WHALE,
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
    super({});
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

export function testConfig(providers: Aggregator[]) {
  return createConfig({
    providers,
    clients: [
      createPublicClient({
        chain: base,
        transport: http(`https://rpc.ankr.com/base/${ANKR_API_KEY}`),
      }) as PublicClient,
    ],
  });
}

const BIGINT_KEY = "__bigint__";

const bigintReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? { [BIGINT_KEY]: value.toString() } : value;

const bigintReviver = (_key: string, value: unknown) => {
  if (value && typeof value === "object" && BIGINT_KEY in value) {
    const stored = (value as Record<string, unknown>)[BIGINT_KEY];
    if (typeof stored === "string") {
      return BigInt(stored);
    }
  }
  return value;
};

export async function recordOutput<T>(name: string, fn: () => Promise<T>): Promise<{ result: T }> {
  const file = `${import.meta.dir}/fixtures/recorded/${name}.json`;

  if (await Bun.file(file).exists()) {
    const content = await Bun.file(file).text();
    return { result: JSON.parse(content, bigintReviver) as T };
  }

  const result = await fn();
  await Bun.write(file, JSON.stringify(result, bigintReplacer, 2));

  return { result };
}

export function recordedQuotes(name: string, swap: SwapParams, config: Config): Promise<Quote[]> {
  const realizedName = `quotes-${name}-${hashSwapParams(swap)}`;

  return recordOutput<Quote[]>(realizedName, async () => {
    const quotes = await getRawQuotes({
      config,
      swap,
    });

    if (!quotes) {
      throw new Error("Simulation failed");
    }

    return quotes;
  }).then((res) => res.result);
}

export function recordedSimulation(
  name: string,
  swap: SwapParams,
  config: Config,
): Promise<SuccessfulSimulatedQuote> {
  const realizedName = `simulation-${name}-${hashSwapParams(swap)}`;

  return recordOutput<SuccessfulSimulatedQuote>(realizedName, async () => {
    const quote = await getQuote({ config, swap, strategy: "fastest" });

    if (!quote) {
      throw new Error("Simulation failed");
    }

    return quote;
  }).then((res) => res.result);
}

function hashSwapParams(swap: SwapParams): number {
  const keys = Object.keys(swap).sort();
  let hash = 0;
  for (const key of keys) {
    const value = (swap as Record<string, unknown>)[key];
    const str = `${key}:${String(value)};`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
  }
  return Math.abs(hash);
}
