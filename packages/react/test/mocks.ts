import { mock } from "bun:test";
import type { MetaAggregator } from "@withfabric/spandex";
import { TEST_ADDRESSES, TEST_CHAINS } from "./constants.js";

export function mockWagmiConnection(options?: {
  address?: string;
  chainId?: number;
  connected?: boolean;
}) {
  const {
    address = TEST_ADDRESSES.alice,
    chainId = TEST_CHAINS.base.id,
    connected = true,
  } = options || {};

  return mock.module("wagmi", () => ({
    useConnection: () => ({
      address: connected ? address : undefined,
      chain: connected ? { id: chainId } : undefined,
    }),
  }));
}

export function createMockMetaAggregator(overrides?: Partial<MetaAggregator>): MetaAggregator {
  return {
    fetchAllQuotes: mock(() => Promise.resolve([])),
    ...overrides,
  } as unknown as MetaAggregator;
}

export function mockBuildMetaAggregator(metaAggregator: MetaAggregator) {
  return mock.module("@withfabric/spandex", () => ({
    buildMetaAggregator: () => metaAggregator,
  }));
}

export function createMockQuote(overrides?: {
  provider?: string;
  outputAmount?: bigint;
  inputAmount?: bigint;
  networkFee?: bigint;
  latency?: number;
}) {
  return {
    success: true,
    provider: overrides?.provider || "fabric",
    outputAmount: overrides?.outputAmount || 1000000n,
    inputAmount: overrides?.inputAmount || 500000000n,
    networkFee: overrides?.networkFee || 100000n,
    latency: overrides?.latency || 150,
    txData: { to: "0xabc", data: "0x123", value: 0n },
  };
}
