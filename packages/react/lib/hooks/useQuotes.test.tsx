import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Quote } from "@spandex/core";
import { createPublicClient, http, type PublicClient } from "viem";
import { base } from "viem/chains";
import { TEST_ADDRESSES, TEST_CHAINS } from "../../test/constants.js";
import { createMockQuote } from "../../test/mocks.js";
import { renderHook, waitFor } from "../../test/utils.js";
import { useQuotes } from "./useQuotes.js";

let mockFetchAllQuotes: ReturnType<typeof mock>;

describe("useQuotes", () => {
  beforeEach(() => {
    mockFetchAllQuotes = mock(() => Promise.resolve([createMockQuote()]));
    mock.module("@spandex/core", () => ({
      getQuotes: mockFetchAllQuotes,
    }));

    mock.module("wagmi", () => ({
      useConnection: () => ({
        address: TEST_ADDRESSES.alice,
        chain: { id: TEST_CHAINS.base.id },
      }),
    }));

    mock.module("wagmi", () => ({
      useConfig: () => ({
        getClient: ({ chainId }: { chainId: number }) => {
          if (chainId === TEST_CHAINS.base.id) {
            return createPublicClient({
              chain: base,
              transport: http("https://base.drpc.org"),
            }) as PublicClient;
          }
          return undefined;
        },
      }),
    }));
  });

  it("should merge wagmi connection data with params", async () => {
    const { result } = renderHook(() =>
      useQuotes({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchAllQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          swap: {
            mode: "exactIn",
            chainId: TEST_CHAINS.base.id,
            swapperAccount: TEST_ADDRESSES.alice,
            inputToken: TEST_ADDRESSES.usdc,
            outputToken: TEST_ADDRESSES.weth,
            inputAmount: 500_000_000n,
            slippageBps: 100,
          },
        }),
      );
      expect(result.current.data).toHaveLength(1);
    });
  });

  it("should accept hook-level overrides", async () => {
    const mockFetchAllQuotes = mock(() => Promise.resolve([]));
    mock.module("@spandex/core", () => ({
      getQuotes: mockFetchAllQuotes,
    }));

    const { result } = renderHook(() =>
      useQuotes({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
          // specify hook-level chain and address, overriding wagmi
          chainId: TEST_CHAINS.mainnet.id,
          swapperAccount: TEST_ADDRESSES.bob,
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchAllQuotes).toHaveBeenCalledWith(
        expect.objectContaining({
          swap: expect.objectContaining({
            chainId: TEST_CHAINS.mainnet.id,
            swapperAccount: TEST_ADDRESSES.bob,
          }),
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

    const { result } = renderHook(() =>
      useQuotes({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
      }),
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchAllQuotes).not.toHaveBeenCalled();
  });

  it("should recognize available tanstack query config - enabled", async () => {
    const { result } = renderHook(() =>
      useQuotes({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
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
    const { result } = renderHook(() =>
      useQuotes({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        query: {
          select: (x: Quote[]) => {
            return x.map((quote) => quote.provider);
          },
        },
      }),
    );
    expect(mockFetchAllQuotes).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.[0]).toEqual("fabric");
    });
  });
});
