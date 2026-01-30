import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createPublicClient, http, type PublicClient } from "viem";
import { base } from "viem/chains";
import { TEST_ADDRESSES, TEST_CHAINS } from "../../test/constants.js";
import { createMockQuote } from "../../test/mocks.js";
import { renderHook, waitFor } from "../../test/utils.js";
import { useQuote } from "./useQuote.js";

let mockFetchQuote: ReturnType<typeof mock>;

describe("useQuote", () => {
  beforeEach(() => {
    mockFetchQuote = mock(() => Promise.resolve(createMockQuote()));
    mock.module("@spandex/core", () => ({
      getQuote: mockFetchQuote,
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
      useQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        strategy: "bestPrice",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: "bestPrice",
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
      expect(result.current.data).toBeDefined();
    });
  });

  it("should accept hook-level overrides", async () => {
    const mockFetchQuote = mock(() => Promise.resolve(createMockQuote()));
    mock.module("@spandex/core", () => ({
      getQuote: mockFetchQuote,
    }));

    const { result } = renderHook(() =>
      useQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
          chainId: TEST_CHAINS.mainnet.id,
          swapperAccount: TEST_ADDRESSES.bob,
        },
        strategy: "bestPrice",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchQuote).toHaveBeenCalledWith(
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
      useQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        strategy: "bestPrice",
      }),
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchQuote).not.toHaveBeenCalled();
  });

  it("should recognize available tanstack query config - enabled", async () => {
    const { result } = renderHook(() =>
      useQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        strategy: "bestPrice",
        query: {
          enabled: false,
        },
      }),
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetchQuote).not.toHaveBeenCalled();
  });

  it("should recognize available tanstack query config - transform", async () => {
    const { result } = renderHook(() =>
      useQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        strategy: "bestPrice",
        query: {
          select: (quote) => quote?.provider,
        },
      }),
    );

    expect(mockFetchQuote).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeDefined();
      expect(result.current.data).toEqual("fabric");
    });
  });
});
