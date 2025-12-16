import { describe, expect, it } from "bun:test";
import { type Address, encodeFunctionData, erc20Abi, zeroAddress } from "viem";
import { buildCalls } from "./buildCalls.js";
import type { Config } from "./createConfig.js";
import type { SuccessfulQuote, SwapParams } from "./types.js";

const baseSwap: SwapParams = {
  chainId: 1,
  inputToken: "0x0000000000000000000000000000000000000001",
  outputToken: "0x0000000000000000000000000000000000000002",
  slippageBps: 50,
  swapperAccount: "0x0000000000000000000000000000000000000003",
  mode: "exactIn",
  inputAmount: 1000n,
};

const config: Config = {
  clientLookup: () => undefined,
  options: {},
  aggregators: [],
};

const baseQuote: SuccessfulQuote = {
  success: true,
  provider: "fabric",
  details: {} as never,
  latency: 1,
  outputAmount: 2000n,
  inputAmount: baseSwap.inputAmount,
  networkFee: 0n,
  txData: {
    to: "0x00000000000000000000000000000000000000aa",
    data: "0xdeadbeef",
  },
} as unknown as SuccessfulQuote;

describe("buildCalls", () => {
  it("builds a single call when eth is the input token", async () => {
    const swap: SwapParams = { ...baseSwap, inputToken: zeroAddress };
    const quote: SuccessfulQuote = { ...baseQuote, approval: undefined };

    const calls = await buildCalls({ quote, swap, config });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.type).toBe("swap");
    expect(calls[0]?.txn).toEqual(quote.txData);
  });

  it("builds with approval call when input token is not eth", async () => {
    const approval = {
      token: "0x00000000000000000000000000000000000000bb" as Address,
      spender: "0x00000000000000000000000000000000000000cc" as Address,
    };
    const quote: SuccessfulQuote = { ...baseQuote, approval };

    const calls = await buildCalls({ quote, swap: baseSwap, config, force: true });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.type).toBe("approval");
    expect(calls[0]?.txn?.to).toBe(approval.token);
    expect(calls[1]?.type).toBe("swap");
  });

  it("builds with approval call with exact amount", async () => {
    const approval = {
      token: "0x00000000000000000000000000000000000000dd" as Address,
      spender: "0x00000000000000000000000000000000000000ee" as Address,
    };
    const quote: SuccessfulQuote = { ...baseQuote, approval, inputAmount: 1234n };

    const calls = await buildCalls({
      quote,
      swap: baseSwap,
      config,
      allowanceMode: "exact",
      force: true,
    });

    const expectedData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [approval.spender, quote.inputAmount],
    });

    expect(calls[0]?.type).toBe("approval");
    expect(calls[0]?.txn.data).toBe(expectedData);
  });

  it("builds with approval call with unlimited amount", async () => {
    const approval = {
      token: "0x00000000000000000000000000000000000000ff" as Address,
      spender: "0x0000000000000000000000000000000000000011" as Address,
    };
    const quote: SuccessfulQuote = { ...baseQuote, approval };

    const calls = await buildCalls({
      quote,
      swap: baseSwap,
      config,
      allowanceMode: "unlimited",
      force: true,
    });

    const expectedData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [
        approval.spender,
        BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
      ],
    });

    expect(calls[0]?.type).toBe("approval");
    expect(calls[0]?.txn?.data).toBe(expectedData);
  });
});
