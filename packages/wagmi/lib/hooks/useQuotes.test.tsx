import { describe, expect, it, mock } from "bun:test";
import type { MetaAggregator, Quote } from "@withfabric/smal";
import { TEST_ADDRESSES, TEST_CHAINS } from "../../test/constants.js";
import { createMockQuote } from "../../test/mocks.js";
import { renderHook, waitFor } from "../../test/utils.js";
import { useQuotes } from "./useQuotes.js";

let mockMetaAggregator: MetaAggregator;

mock.module("@withfabric/smal", () => ({
  buildMetaAggregator: () => mockMetaAggregator,
}));

mock.module("wagmi", () => ({
  useConnection: () => ({
    address: TEST_ADDRESSES.alice,
    chain: { id: TEST_CHAINS.base.id },
  }),
}));

describe("useQuotes", () => {
  it("should merge wagmi connection data with params", async () => {
    const mockFetchAllQuotes = mock(() => Promise.resolve([createMockQuote()]));

    mockMetaAggregator = {
      fetchAllQuotes: mockFetchAllQuotes,
    } as unknown as MetaAggregator;

    const { result } = renderHook(() =>
      useQuotes({
        mode: "exactInQuote",
        inputToken: TEST_ADDRESSES.usdc,
        outputToken: TEST_ADDRESSES.weth,
        inputAmount: 500_000_000n,
        slippageBps: 100,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchAllQuotes).toHaveBeenCalledWith({
        mode: "exactInQuote",
        chainId: TEST_CHAINS.base.id,
        swapperAccount: TEST_ADDRESSES.alice,
        inputToken: TEST_ADDRESSES.usdc,
        outputToken: TEST_ADDRESSES.weth,
        inputAmount: 500_000_000n,
        slippageBps: 100,
      });
      expect(result.current.data).toHaveLength(1);
    });
  });

  it("should accept hook-level overrides", async () => {
    const mockFetchAllQuotes = mock(() => Promise.resolve([]));

    mockMetaAggregator = {
      fetchAllQuotes: mockFetchAllQuotes,
    } as unknown as MetaAggregator;

    const { result } = renderHook(() =>
      useQuotes({
        mode: "exactInQuote",
        inputToken: TEST_ADDRESSES.usdc,
        outputToken: TEST_ADDRESSES.weth,
        inputAmount: 500_000_000n,
        slippageBps: 100,
        // specify hook-level chain and address, overriding wagmi
        chainId: TEST_CHAINS.mainnet.id,
        swapperAccount: TEST_ADDRESSES.bob,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchAllQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: TEST_CHAINS.mainnet.id,
          swapperAccount: TEST_ADDRESSES.bob,
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

    const { result } = renderHook(() =>
      useQuotes({
        mode: "exactInQuote",
        inputToken: TEST_ADDRESSES.usdc,
        outputToken: TEST_ADDRESSES.weth,
        inputAmount: 500_000_000n,
        slippageBps: 100,
      }),
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchAllQuotes).not.toHaveBeenCalled();
  });

  it("should recognize available tanstack query config - enabled", async () => {
    const mockFetchAllQuotes = mock(() => Promise.resolve([]));

    mockMetaAggregator = {
      fetchAllQuotes: mockFetchAllQuotes,
    } as unknown as MetaAggregator;

    const { result } = renderHook(() =>
      useQuotes({
        mode: "exactInQuote",
        inputToken: TEST_ADDRESSES.usdc,
        outputToken: TEST_ADDRESSES.weth,
        inputAmount: 500_000_000n,
        slippageBps: 100,
        query: {
          enabled: false,
        },
      }),
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchAllQuotes).not.toHaveBeenCalled();
  });

  it("should recognize available tanstack query config - transform", async () => {
    const mockFetchAllQuotes = mock(() => Promise.resolve([]));

    mockMetaAggregator = {
      fetchAllQuotes: mockFetchAllQuotes,
    } as unknown as MetaAggregator;

    const { result } = renderHook(() =>
      useQuotes({
        mode: "exactInQuote",
        inputToken: TEST_ADDRESSES.usdc,
        outputToken: TEST_ADDRESSES.weth,
        inputAmount: 500_000_000n,
        slippageBps: 100,
        query: {
          select: (x: Quote[]) => {
            return x.map((quote) => quote.provider);
          },
        },
      }),
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchAllQuotes).not.toHaveBeenCalled();
  });
});
