import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { SuccessfulSimulatedQuote } from "@spandex/core";
import { act } from "@testing-library/react";
import { createPublicClient, http, type PublicClient } from "viem";
import { base } from "viem/chains";
import { TEST_ADDRESSES, TEST_CHAINS } from "../../test/constants.js";
import { createMockQuote } from "../../test/mocks.js";
import { renderHook, waitFor } from "../../test/utils.js";
import { useExecuteQuote } from "./useExecuteQuote.js";

const transactionHashes = {
  approval: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  swap: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const,
  batch: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const,
};

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
  let mockBuildCalls: ReturnType<typeof mock>;
  let mockGetCapabilities: ReturnType<typeof mock>;
  let mockSendTransactionSync: ReturnType<typeof mock>;
  let mockSendCallsSync: ReturnType<typeof mock>;

  beforeEach(() => {
    mockBuildCalls = mock();
    mockGetCapabilities = mock(() => Promise.resolve({ atomic: { status: "unsupported" } }));
    mockSendTransactionSync = mock(({ data }: { data: string }) =>
      Promise.resolve({
        transactionHash: data === "0xapprove" ? transactionHashes.approval : transactionHashes.swap,
      }),
    );
    mockSendCallsSync = mock(() =>
      Promise.resolve({
        status: "success",
        receipts: [{ transactionHash: transactionHashes.batch }],
      }),
    );

    mock.module("@spandex/core", () => ({
      buildCalls: mockBuildCalls,
    }));

    mock.module("wagmi", () => ({
      useConnection: () => ({
        address: TEST_ADDRESSES.alice,
        chain: { id: TEST_CHAINS.base.id },
      }),
      useWalletClient: () => ({
        data: {
          account: TEST_ADDRESSES.alice,
          chain: { id: TEST_CHAINS.base.id },
          getCapabilities: mockGetCapabilities,
          sendTransactionSync: mockSendTransactionSync,
          sendCallsSync: mockSendCallsSync,
        },
      }),
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

  it("prepares and executes a single-call route", async () => {
    const quote = createMockSimulatedQuote();
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([
        {
          type: "swap",
          txn: { to: TEST_ADDRESSES.weth, data: "0xswap", chainId: TEST_CHAINS.base.id },
        },
      ]),
    );

    const { result } = renderHook(() =>
      useExecuteQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        quote,
      }),
    );

    await waitFor(() => {
      expect(result.current.mode).toBe("single");
      expect(result.current.currentActionLabel).toBe("Swap");
      expect(result.current.totalSteps).toBe(1);
      expect(result.current.canAutoExecute).toBe(true);
      expect(result.current.steps[0]?.status).toBe("active");
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(mockBuildCalls).toHaveBeenCalled();
      expect(mockSendTransactionSync).toHaveBeenCalledTimes(1);
      expect(mockSendCallsSync).not.toHaveBeenCalled();
      expect(result.current.data).toEqual({
        transactionHash: transactionHashes.swap,
        mode: "single",
        stepIndex: 1,
        totalSteps: 1,
        action: "Swap",
        completed: true,
      });
      expect(result.current.steps[0]?.status).toBe("complete");
    });
  });

  it("batches approval and swap when atomic execution is supported", async () => {
    const quote = createMockSimulatedQuote();
    mockGetCapabilities.mockImplementation(() =>
      Promise.resolve({ atomic: { status: "supported" } }),
    );
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([
        {
          type: "approval",
          txn: { to: TEST_ADDRESSES.usdc, data: "0xapprove", chainId: TEST_CHAINS.base.id },
        },
        {
          type: "swap",
          txn: { to: TEST_ADDRESSES.weth, data: "0xswap", chainId: TEST_CHAINS.base.id },
        },
      ]),
    );

    const { result } = renderHook(() =>
      useExecuteQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        quote,
      }),
    );

    await waitFor(() => {
      expect(result.current.mode).toBe("batched");
      expect(result.current.currentActionLabel).toBe("Approve & Swap");
      expect(result.current.canAutoExecute).toBe(true);
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(mockSendCallsSync).toHaveBeenCalledTimes(1);
      expect(mockSendTransactionSync).not.toHaveBeenCalled();
      expect(result.current.steps.every((step) => step.status === "complete")).toBe(true);
      expect(result.current.data).toEqual({
        transactionHash: transactionHashes.batch,
        mode: "batched",
        stepIndex: 2,
        totalSteps: 2,
        action: "Approve & Swap",
        completed: true,
      });
    });
  });

  it("steps through approval and swap when batching is unavailable", async () => {
    const quote = createMockSimulatedQuote();
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([
        {
          type: "approval",
          txn: { to: TEST_ADDRESSES.usdc, data: "0xapprove", chainId: TEST_CHAINS.base.id },
        },
        {
          type: "swap",
          txn: { to: TEST_ADDRESSES.weth, data: "0xswap", chainId: TEST_CHAINS.base.id },
        },
      ]),
    );

    const { result } = renderHook(() =>
      useExecuteQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        quote,
      }),
    );

    await waitFor(() => {
      expect(result.current.mode).toBe("stepped");
      expect(result.current.currentActionLabel).toBe("Approve");
      expect(result.current.currentStepIndex).toBe(1);
      expect(result.current.currentStepText).toBe("Step 1 of 2");
      expect(result.current.canAutoExecute).toBe(false);
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(mockSendTransactionSync).toHaveBeenCalledTimes(1);
      expect(result.current.steps[0]).toMatchObject({
        status: "complete",
        hash: transactionHashes.approval,
      });
      expect(result.current.steps[1]?.status).toBe("active");
      expect(result.current.currentActionLabel).toBe("Swap");
      expect(result.current.currentStepIndex).toBe(2);
      expect(result.current.currentStepText).toBe("Step 2 of 2");
      expect(result.current.data).toEqual({
        transactionHash: transactionHashes.approval,
        mode: "stepped",
        stepIndex: 1,
        totalSteps: 2,
        action: "Approve",
        completed: false,
      });
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(mockSendTransactionSync).toHaveBeenCalledTimes(2);
      expect(result.current.steps[1]).toMatchObject({
        status: "complete",
        hash: transactionHashes.swap,
      });
      expect(result.current.currentActionLabel).toBeNull();
      expect(result.current.currentStepIndex).toBeNull();
      expect(result.current.currentStepText).toBeNull();
      expect(result.current.data).toEqual({
        transactionHash: transactionHashes.swap,
        mode: "stepped",
        stepIndex: 2,
        totalSteps: 2,
        action: "Swap",
        completed: true,
      });
    });
  });

  it("surfaces a clear preparation error when chainId and swapperAccount cannot be resolved", async () => {
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
    const { result } = renderHook(() =>
      useExecuteQuote({
        swap: {
          mode: "exactIn",
          inputToken: TEST_ADDRESSES.usdc,
          outputToken: TEST_ADDRESSES.weth,
          inputAmount: 500_000_000n,
          slippageBps: 100,
        },
        quote,
      }),
    );

    await waitFor(() => {
      expect(result.current.preparationError?.message).toBe(
        "No chainId provided to useExecuteQuote. Pass swap.chainId or connect a wallet on the target chain.",
      );
    });

    await act(async () => {
      await expect(result.current.executeQuoteAsync()).rejects.toThrow(
        "No chainId provided to useExecuteQuote",
      );
    });
  });
});
