import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { SuccessfulSimulatedQuote } from "@spandex/core";
import { act } from "@testing-library/react";
import { createPublicClient, http, type PublicClient } from "viem";
import { base, mainnet } from "viem/chains";
import { TEST_ADDRESSES, TEST_CHAINS } from "../../test/constants.js";
import { createMockQuote } from "../../test/mocks.js";
import { renderHook, waitFor } from "../../test/utils.js";
import { useExecuteQuote } from "./useExecuteQuote.js";

const walletClient = {
  account: TEST_ADDRESSES.alice,
  chain: { id: TEST_CHAINS.base.id },
} as const;

function createMockSimulatedQuote(): SuccessfulSimulatedQuote {
  return {
    ...createMockQuote(),
    simulation: {
      success: true,
      outputAmount: 1_000_000n,
      latency: 25,
      gasUsed: 123_456n,
      approvalGasUsed: 45_000n,
      blockNumber: 123n,
      swapResult: {
        status: "success",
      },
    },
    performance: {
      latency: 25,
      gasUsed: 123_456n,
      outputAmount: 1_000_000n,
      priceDelta: 0,
      accuracy: 0,
    },
  } as SuccessfulSimulatedQuote;
}

describe("useExecuteQuote", () => {
  let mockExecuteQuote: ReturnType<typeof mock>;

  beforeEach(() => {
    mockExecuteQuote = mock(() =>
      Promise.resolve({
        transactionHash:
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
      }),
    );

    mock.module("@spandex/core", () => ({
      executeQuote: mockExecuteQuote,
    }));

    mock.module("wagmi", () => ({
      useConnection: () => ({
        address: TEST_ADDRESSES.alice,
        chain: { id: TEST_CHAINS.base.id },
      }),
      useWalletClient: () => ({
        data: walletClient,
      }),
      useConfig: () => ({
        getClient: ({ chainId }: { chainId: number }) => {
          if (chainId === TEST_CHAINS.base.id) {
            return createPublicClient({
              chain: base,
              transport: http("https://base.drpc.org"),
            }) as PublicClient;
          }

          if (chainId === TEST_CHAINS.mainnet.id) {
            return createPublicClient({
              chain: mainnet,
              transport: http("https://eth.drpc.org"),
            }) as PublicClient;
          }

          return undefined;
        },
      }),
    }));
  });

  it("should merge wagmi connection data with params and execute the quote", async () => {
    const quote = createMockSimulatedQuote();
    const { result } = renderHook(() => useExecuteQuote());

    await act(async () => {
      await result.current.executeQuoteAsync({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        quote,
      });
    });

    await waitFor(() => {
      expect(mockExecuteQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          quote,
          walletClient,
          allowanceMode: "exact",
          swap: {
            mode: "exactIn",
            chainId: TEST_CHAINS.base.id,
            inputToken: TEST_ADDRESSES.usdc,
            outputToken: TEST_ADDRESSES.weth,
            inputAmount: 500_000_000n,
            slippageBps: 100,
            swapperAccount: TEST_ADDRESSES.alice,
            outputChainId: undefined,
            recipientAccount: undefined,
          },
        }),
      );

      expect(mockExecuteQuote.mock.calls[0]?.[0]?.publicClient?.chain?.id).toBe(
        TEST_CHAINS.base.id,
      );
      expect(result.current.data).toEqual({
        transactionHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      });
    });
  });

  it("should allow per-call allowanceMode and swap overrides", async () => {
    const quote = createMockSimulatedQuote();
    const { result } = renderHook(() =>
      useExecuteQuote({
        allowanceMode: "exact",
      }),
    );

    await act(async () => {
      await result.current.executeQuoteAsync({
        swap: {
          mode: "targetOut",
          chainId: TEST_CHAINS.mainnet.id,
          swapperAccount: TEST_ADDRESSES.bob,
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          outputAmount: 1_000_000n,
          slippageBps: 75,
          recipientAccount: TEST_ADDRESSES.alice,
        },
        quote,
        allowanceMode: "unlimited",
      });
    });

    await waitFor(() => {
      expect(mockExecuteQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          allowanceMode: "unlimited",
          swap: {
            mode: "targetOut",
            chainId: TEST_CHAINS.mainnet.id,
            swapperAccount: TEST_ADDRESSES.bob,
            inputToken: TEST_ADDRESSES.usdc,
            outputToken: TEST_ADDRESSES.weth,
            outputAmount: 1_000_000n,
            slippageBps: 75,
            outputChainId: undefined,
            recipientAccount: TEST_ADDRESSES.alice,
          },
        }),
      );

      expect(mockExecuteQuote.mock.calls[0]?.[0]?.publicClient?.chain?.id).toBe(
        TEST_CHAINS.mainnet.id,
      );
    });
  });

  it("should surface a clear error when chainId and swapperAccount cannot be resolved", async () => {
    mock.module("wagmi", () => ({
      useConnection: () => ({
        address: undefined,
        chain: undefined,
      }),
      useWalletClient: () => ({
        data: undefined,
      }),
      useConfig: () => ({
        getClient: () => undefined,
      }),
    }));

    const quote = createMockSimulatedQuote();
    const { result } = renderHook(() => useExecuteQuote());

    await act(async () => {
      await expect(
        result.current.executeQuoteAsync({
          swap: {
            mode: "exactIn",
            inputToken: TEST_ADDRESSES.usdc,
            outputToken: TEST_ADDRESSES.weth,
            inputAmount: 500_000_000n,
            slippageBps: 100,
          },
          quote,
        }),
      ).rejects.toThrow("No chainId provided to useExecuteQuote");
    });

    expect(mockExecuteQuote).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.error?.message).toBe(
        "No chainId provided to useExecuteQuote. Pass swap.chainId or connect a wallet on the target chain.",
      );
    });
  });
});
