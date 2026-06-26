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

let mockBuildCalls: ReturnType<typeof mock>;
let mockGetCapabilities: ReturnType<typeof mock>;
let mockSendTransactionSync: ReturnType<typeof mock>;
let mockSendCallsSync: ReturnType<typeof mock>;
let mockCapabilitiesData:
  | { atomic?: { status: "supported" | "ready" | "unsupported" } }
  | undefined;

const defaultSwap = {
  mode: "exactIn" as const,
  inputToken: TEST_ADDRESSES.usdc,
  outputToken: TEST_ADDRESSES.weth,
  inputAmount: 500_000_000n,
  slippageBps: 100,
};

type TestSwap = typeof defaultSwap & {
  chainId?: number;
  outputChainId?: number;
  swapperAccount?: `0x${string}`;
  recipientAccount?: `0x${string}`;
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

function createMockQuoteWithTxData(data: string): SuccessfulSimulatedQuote {
  return {
    ...createMockSimulatedQuote(),
    txData: {
      ...createMockQuote().txData,
      data,
    },
  } as SuccessfulSimulatedQuote;
}

function createSwap(overrides: Partial<TestSwap> = {}): TestSwap {
  return {
    ...defaultSwap,
    ...overrides,
  };
}

function createBuiltCall({
  type,
  data,
  to,
}: {
  type: "approval" | "swap";
  data: string;
  to: `0x${string}`;
}) {
  return {
    type,
    txn: {
      to,
      data,
      chainId: TEST_CHAINS.base.id,
    },
  };
}

function setupWagmi({
  address = TEST_ADDRESSES.alice,
  chainId = TEST_CHAINS.base.id,
  hasWalletClient = true,
  hasPublicClient = true,
}: {
  address?: `0x${string}` | null;
  chainId?: number | null;
  hasWalletClient?: boolean;
  hasPublicClient?: boolean;
} = {}) {
  const resolvedAddress = address ?? undefined;
  const resolvedChainId = chainId ?? undefined;

  mock.module("wagmi", () => ({
    useConnection: () => ({
      address: resolvedAddress,
      chain: resolvedChainId ? { id: resolvedChainId } : undefined,
    }),
    useCapabilities: () => ({
      data: mockCapabilitiesData,
    }),
    useWalletClient: () => ({
      data: hasWalletClient
        ? {
            account: resolvedAddress,
            chain: resolvedChainId ? { id: resolvedChainId } : undefined,
            getCapabilities: mockGetCapabilities,
            sendTransactionSync: mockSendTransactionSync,
            sendCallsSync: mockSendCallsSync,
            uid: "test-wallet-client",
          }
        : undefined,
    }),
    useConfig: () => ({
      getClient: ({ chainId: requestedChainId }: { chainId: number }) => {
        if (hasPublicClient && requestedChainId === TEST_CHAINS.base.id) {
          return createPublicClient({
            chain: base,
            transport: http("https://base.drpc.org"),
          }) as PublicClient;
        }

        return undefined;
      },
    }),
  }));
}

function renderUseExecuteQuote({
  swap,
  quote = createMockSimulatedQuote(),
  ...params
}: {
  swap?: Partial<TestSwap>;
  quote?: SuccessfulSimulatedQuote;
  allowanceMode?: "exact" | "unlimited";
  preparation?: { enabled?: boolean };
} = {}) {
  return {
    quote,
    ...renderHook(() =>
      useExecuteQuote({
        swap: createSwap(swap),
        quote,
        ...params,
      }),
    ),
  };
}

describe("useExecuteQuote", () => {
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
    mockCapabilitiesData = {
      atomic: {
        status: "unsupported",
      },
    };

    mock.module("@spandex/core", () => ({
      buildCalls: mockBuildCalls,
    }));
    setupWagmi();
  });

  it("prepares and executes a single-call route", async () => {
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: "0xswap" })]),
    );

    const { result } = renderUseExecuteQuote();

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

  it("rebuilds the execution plan when a per-call allowance override changes it", async () => {
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: "0xswap" })]),
    );

    const { result } = renderUseExecuteQuote({ allowanceMode: "exact" });

    await waitFor(() => {
      expect(mockBuildCalls).toHaveBeenCalledTimes(1);
      expect(mockBuildCalls.mock.calls[0]?.[0]?.allowanceMode).toBe("exact");
    });

    await act(async () => {
      await result.current.executeQuoteAsync({ allowanceMode: "unlimited" });
    });

    await waitFor(() => {
      expect(mockBuildCalls).toHaveBeenCalledTimes(2);
      expect(mockBuildCalls.mock.calls[1]?.[0]?.allowanceMode).toBe("unlimited");
    });
  });

  it("does not prepare calls until enabled when preparation is disabled", async () => {
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: "0xswap" })]),
    );

    const { result } = renderUseExecuteQuote({
      preparation: {
        enabled: false,
      },
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(false);
      expect(mockBuildCalls).not.toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(mockBuildCalls).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual({
        transactionHash: transactionHashes.swap,
        mode: "single",
        stepIndex: 1,
        totalSteps: 1,
        action: "Swap",
        completed: true,
      });
    });
  });

  it("surfaces stepped UI state after on-demand plan building", async () => {
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([
        createBuiltCall({ type: "approval", to: TEST_ADDRESSES.usdc, data: "0xapprove" }),
        createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: "0xswap" }),
      ]),
    );

    const { result } = renderUseExecuteQuote({
      preparation: {
        enabled: false,
      },
    });

    await waitFor(() => {
      expect(result.current.mode).toBeNull();
      expect(result.current.steps).toHaveLength(0);
      expect(mockBuildCalls).not.toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(result.current.mode).toBe("stepped");
      expect(result.current.currentActionLabel).toBe("Swap");
      expect(result.current.currentStepIndex).toBe(2);
      expect(result.current.currentStepText).toBe("Step 2 of 2");
      expect(result.current.steps[0]).toMatchObject({
        status: "complete",
        hash: transactionHashes.approval,
      });
      expect(result.current.steps[1]?.status).toBe("active");
    });
  });

  it("does not bypass wallet requirements when preparation.enabled is true", async () => {
    setupWagmi({
      address: null,
      chainId: null,
      hasWalletClient: false,
      hasPublicClient: false,
    });

    const { result } = renderUseExecuteQuote({
      swap: {
        chainId: TEST_CHAINS.base.id,
        swapperAccount: TEST_ADDRESSES.alice,
      },
      preparation: {
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(result.current.preparationError?.message).toBe(
        "No WalletClient available from wagmi. Connect a wallet before executing.",
      );
      expect(result.current.isPreparing).toBe(false);
      expect(mockBuildCalls).not.toHaveBeenCalled();
    });
  });

  it("batches approval and swap when atomic execution is supported", async () => {
    mockCapabilitiesData = {
      atomic: {
        status: "supported",
      },
    };
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([
        createBuiltCall({ type: "approval", to: TEST_ADDRESSES.usdc, data: "0xapprove" }),
        createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: "0xswap" }),
      ]),
    );

    const { result } = renderUseExecuteQuote();

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

  it("treats atomic ready as batch-capable", async () => {
    mockCapabilitiesData = {
      atomic: {
        status: "ready",
      },
    };
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([
        createBuiltCall({ type: "approval", to: TEST_ADDRESSES.usdc, data: "0xapprove" }),
        createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: "0xswap" }),
      ]),
    );

    const { result } = renderUseExecuteQuote();

    await waitFor(() => {
      expect(result.current.mode).toBe("batched");
      expect(result.current.canAutoExecute).toBe(true);
      expect(result.current.currentActionLabel).toBe("Approve & Swap");
    });
  });

  it("steps through approval and swap when batching is unavailable", async () => {
    mockBuildCalls.mockImplementation(() =>
      Promise.resolve([
        createBuiltCall({ type: "approval", to: TEST_ADDRESSES.usdc, data: "0xapprove" }),
        createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: "0xswap" }),
      ]),
    );

    const { result } = renderUseExecuteQuote();

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

  it("keeps stepped progress when a new quote arrives between clicks", async () => {
    mockBuildCalls.mockImplementation(({ quote }: { quote: SuccessfulSimulatedQuote }) =>
      Promise.resolve([
        createBuiltCall({ type: "approval", to: TEST_ADDRESSES.usdc, data: "0xapprove" }),
        createBuiltCall({ type: "swap", to: TEST_ADDRESSES.weth, data: quote.txData.data }),
      ]),
    );

    const firstQuote = createMockQuoteWithTxData("0xswap1");
    const secondQuote = createMockQuoteWithTxData("0xswap2");

    const { result, rerender } = renderHook(
      ({ quote }: { quote: SuccessfulSimulatedQuote }) =>
        useExecuteQuote({
          swap: createSwap(),
          quote,
        }),
      {
        initialProps: {
          quote: firstQuote,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.mode).toBe("stepped");
      expect(result.current.currentActionLabel).toBe("Approve");
      expect(result.current.currentStepIndex).toBe(1);
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(result.current.currentActionLabel).toBe("Swap");
      expect(result.current.currentStepIndex).toBe(2);
      expect(result.current.steps[0]?.hash).toBe(transactionHashes.approval);
    });

    await act(async () => {
      rerender({ quote: secondQuote });
    });

    await waitFor(() => {
      expect(result.current.currentActionLabel).toBe("Swap");
      expect(result.current.currentStepIndex).toBe(2);
      expect(result.current.steps[0]?.hash).toBe(transactionHashes.approval);
      expect(result.current.steps[1]?.status).toBe("active");
    });

    await act(async () => {
      await result.current.executeQuoteAsync();
    });

    await waitFor(() => {
      expect(mockSendTransactionSync).toHaveBeenCalledTimes(2);
      expect(mockSendTransactionSync.mock.calls[1]?.[0]?.data).toBe("0xswap1");
    });
  });

  it("surfaces a clear preparation error when chainId and swapperAccount cannot be resolved", async () => {
    setupWagmi({
      address: null,
      chainId: null,
      hasWalletClient: false,
      hasPublicClient: false,
    });

    const { result } = renderUseExecuteQuote();

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
