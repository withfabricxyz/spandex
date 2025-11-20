import { describe, expect, it, mock } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import type { MetaAggregator } from "@withfabric/smal";
import type { ReactNode } from "react";
import { SmalProvider } from "../context/SmalProvider.js";
import { useQuotes } from "./useQuotes.js";

let mockMetaAggregator: MetaAggregator;

mock.module("@withfabric/smal", () => ({
  buildMetaAggregator: () => mockMetaAggregator,
}));

mock.module("wagmi", () => ({
  useConnection: () => ({
    address: "0x1234567890123456789012345678901234567890" as const,
    chain: { id: 8453 },
  }),
}));

// simulate app with SmalProvider
function createApp() {
  return function App({ children }: { children: ReactNode }) {
    return (
      <SmalProvider
        config={{
          aggregators: [{ provider: "fabric", config: {} }],
          defaults: { strategy: "quotedPrice" },
        }}
      >
        {children}
      </SmalProvider>
    );
  };
}

describe("useQuotes", () => {
  it("should merge wagmi connection data with params", async () => {
    const mockFetchAllQuotes = mock(() =>
      Promise.resolve([
        {
          success: true,
          provider: "fabric",
          outputAmount: 1000000n,
          inputAmount: 500000000n,
          networkFee: 100000n,
          latency: 150,
          txData: { to: "0xabc", data: "0x123", value: 0n },
        },
      ]),
    );

    mockMetaAggregator = {
      fetchAllQuotes: mockFetchAllQuotes,
    } as unknown as MetaAggregator;

    const app = createApp();

    const { result } = renderHook(
      () =>
        useQuotes({
          mode: "exactInQuote",
          inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          outputToken: "0x4200000000000000000000000000000000000006",
          inputAmount: 500_000_000n,
          slippageBps: 100,
        }),
      { wrapper: app },
    );

    await result.current.getQuotes();

    await waitFor(() => {
      expect(mockFetchAllQuotes).toHaveBeenCalledWith({
        mode: "exactInQuote",
        chainId: 8453,
        swapperAccount: "0x1234567890123456789012345678901234567890",
        inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        outputToken: "0x4200000000000000000000000000000000000006",
        inputAmount: 500_000_000n,
        slippageBps: 100,
      });
    });
  });

  it("should accept hook-level overrides", async () => {
    const mockFetchAllQuotes = mock(() => Promise.resolve([]));

    mockMetaAggregator = {
      fetchAllQuotes: mockFetchAllQuotes,
    } as unknown as MetaAggregator;

    const app = createApp();

    const { result } = renderHook(
      () =>
        useQuotes({
          mode: "exactInQuote",
          inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          outputToken: "0x4200000000000000000000000000000000000006",
          inputAmount: 500_000_000n,
          slippageBps: 100,
          // specify hook-level chain and address, overriding wagmi
          chainId: 1,
          swapperAccount: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        }),
      { wrapper: app },
    );

    await result.current.getQuotes();

    await waitFor(() => {
      expect(mockFetchAllQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 1,
          swapperAccount: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        }),
      );
    });
  });

  it("should return null when chainId or swapperAccount is missing", async () => {
    mock.module("wagmi", () => ({
      useConnection: () => ({
        address: undefined,
        chain: undefined,
      }),
    }));

    const mockFetchAllQuotes = mock(() => Promise.resolve([]));

    mockMetaAggregator = {
      fetchAllQuotes: mockFetchAllQuotes,
    } as unknown as MetaAggregator;

    const app = createApp();

    const { result } = renderHook(
      () =>
        useQuotes({
          mode: "exactInQuote",
          inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          outputToken: "0x4200000000000000000000000000000000000006",
          inputAmount: 500_000_000n,
          slippageBps: 100,
        }),
      { wrapper: app },
    );

    const quotes = await result.current.getQuotes();

    expect(quotes).toBeNull();
    expect(mockFetchAllQuotes).not.toHaveBeenCalled();
  });
});
