import { describe, expect, it } from "bun:test";
import type { PublicClient, StateOverride } from "viem";
import { parseEther, toHex } from "viem";
import { base } from "viem/chains";
import { defaultSwapParams, quoteSuccess } from "../test/utils.js";
import { mergeSimulationStateOverrides, simulateQuote, simulateQuotes } from "./simulateQuote.js";
import type { SimulationOptions, SuccessfulQuote } from "./types.js";

const slot = toHex(1n, { size: 32 });
const slotValue = toHex(500_000_000n, { size: 32 });

describe("simulation state overrides", () => {
  it("keeps defaults, adds other accounts, and lets caller values win", () => {
    const swapper = "0x2222222222222222222222222222222222222222";
    const token = "0x4444444444444444444444444444444444444444";
    const base: StateOverride = [{ address: swapper, balance: parseEther("10000") }];
    const extra: StateOverride = [
      {
        address: swapper,
        balance: 123n,
        stateDiff: [{ slot: "0x01", value: "0x02" }],
      },
      {
        address: token,
        balance: 1n,
      },
    ];

    expect(mergeSimulationStateOverrides(base, extra)).toEqual([
      {
        address: swapper,
        balance: 123n,
        stateDiff: [{ slot: "0x01", value: "0x02" }],
      },
      {
        address: token,
        balance: 1n,
      },
    ]);
  });

  it("matches addresses and storage slots case-insensitively", () => {
    const lowerAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const upperAddress = "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD";
    const merged = mergeSimulationStateOverrides(
      [
        {
          address: lowerAddress,
          stateDiff: [
            { slot: "0xAA", value: "0x01" },
            { slot: "0xbb", value: "0x02" },
          ],
        },
      ],
      [
        {
          address: upperAddress,
          stateDiff: [
            { slot: "0xaa", value: "0x03" },
            { slot: "0xCC", value: "0x04" },
          ],
        },
      ],
    );

    expect(merged).toEqual([
      {
        address: upperAddress,
        stateDiff: [
          { slot: "0xaa", value: "0x03" },
          { slot: "0xbb", value: "0x02" },
          { slot: "0xCC", value: "0x04" },
        ],
      },
    ]);
  });

  it("uses an incoming full state instead of an existing stateDiff", () => {
    const address = "0x3333333333333333333333333333333333333333";
    const merged = mergeSimulationStateOverrides(
      [{ address, stateDiff: [{ slot: "0x01", value: "0x01" }] }],
      [{ address, state: [{ slot: "0x02", value: "0x02" }] }],
    );

    expect(merged).toEqual([
      {
        address,
        state: [{ slot: "0x02", value: "0x02" }],
      },
    ]);
  });

  it("uses an incoming stateDiff instead of an existing full state", () => {
    const address = "0x3333333333333333333333333333333333333333";
    const merged = mergeSimulationStateOverrides(
      [{ address, state: [{ slot: "0x01", value: "0x01" }] }],
      [{ address, stateDiff: [{ slot: "0x02", value: "0x02" }] }],
    );

    expect(merged).toEqual([
      {
        address,
        stateDiff: [{ slot: "0x02", value: "0x02" }],
      },
    ]);
  });

  it("injects merged overrides into same-chain simulateCalls", async () => {
    const requests: CapturedRequest[] = [];
    const client = createSimulationClient(requests);
    const simulationOptions: SimulationOptions = {
      stateOverrides: [
        {
          address: defaultSwapParams.swapperAccount,
          balance: 123n,
        },
        {
          address: defaultSwapParams.inputToken,
          stateDiff: [{ slot, value: slotValue }],
        },
      ],
    };

    const quote = await simulateQuote({
      client,
      swap: defaultSwapParams,
      quote: validQuote(),
      simulationOptions,
    });

    expect(quote.simulation.success).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.params[0].blockStateCalls[0]?.stateOverrides).toEqual({
      [defaultSwapParams.swapperAccount]: {
        balance: "0x7b",
      },
      [defaultSwapParams.inputToken]: {
        stateDiff: {
          [slot]: slotValue,
        },
      },
    });
  });

  it("threads overrides through batch cross-chain simulation", async () => {
    const requests: CapturedRequest[] = [];
    const client = createSimulationClient(requests);
    const crossChainSwap = {
      ...defaultSwapParams,
      outputChainId: 10,
    };
    const simulationOptions: SimulationOptions = {
      stateOverrides: [
        {
          address: defaultSwapParams.inputToken,
          stateDiff: [{ slot, value: slotValue }],
        },
      ],
    };

    const quotes = await simulateQuotes({
      client,
      swap: crossChainSwap,
      quotes: [{ ...validQuote(), outputChainId: 10 }],
      simulationOptions,
    });

    expect(quotes[0]?.simulation.success).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.params[0].blockStateCalls[0]?.stateOverrides).toEqual({
      [defaultSwapParams.swapperAccount]: {
        balance: toHex(parseEther("10000")),
      },
      [defaultSwapParams.inputToken]: {
        stateDiff: {
          [slot]: slotValue,
        },
      },
    });
  });
});

type CapturedRequest = {
  method: string;
  params: [
    {
      blockStateCalls: Array<{
        calls: unknown[];
        stateOverrides?: Record<string, unknown>;
      }>;
    },
    unknown,
  ];
};

function validQuote(): SuccessfulQuote {
  return {
    ...quoteSuccess,
    txData: {
      to: "0x1111111111111111111111111111111111111111",
      data: "0x",
    },
  };
}

function createSimulationClient(requests: CapturedRequest[]): PublicClient {
  return {
    chain: base,
    request: async (request: CapturedRequest) => {
      requests.push(request);
      const calls = request.params[0].blockStateCalls[0]?.calls ?? [];
      return [
        {
          number: "0x1",
          calls: calls.map((_, index) => ({
            status: "0x1",
            gasUsed: "0x1",
            returnData:
              index === 1
                ? toHex(100n, { size: 32 })
                : index === 3
                  ? toHex(200n, { size: 32 })
                  : "0x",
          })),
        },
      ];
    },
  } as unknown as PublicClient;
}
