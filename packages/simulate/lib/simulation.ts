import type { Address, PublicClient } from "viem";
import { keccak256 } from "viem";
import { simulateCalls } from "viem/actions";
import type { SimulationResult } from "./SimulatedMetaAggregator/types";

type SimulateSwapParams = {
  from: Address;
  to: Address;
  data: `0x${string}`;
  value?: bigint;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
};

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;

function pad64(input: string): string {
  return input.padStart(64, "0");
}

/**
 * Calculate the storage slot for an ERC20 token balance in a mapping(address => uint256)
 * Most ERC20 tokens use slot 0 for balances, but this can vary
 */
function getBalanceStorageSlot(userAddress: Address, slot = 0): `0x${string}` {
  // Solidity storage slot calculation for mapping: keccak256(abi.encode(key, slot))
  const paddedSlot = pad64(slot.toString(16));
  const paddedAddress = pad64(userAddress.slice(2));
  const concatenated = `0x${paddedAddress}${paddedSlot}` as `0x${string}`;
  return keccak256(concatenated);
}

function prepareStateOverrides(tokenAddress: Address, userAddress: Address, amount: bigint) {
  const balanceSlot = getBalanceStorageSlot(userAddress, 0); // TODO: detect actual slot?
  const balanceHex = `0x${pad64(amount.toString(16))}` as `0x${string}`;

  return [
    {
      address: tokenAddress,
      stateDiff: [
        {
          slot: balanceSlot,
          value: balanceHex,
        },
      ],
    },
  ];
}

async function getTokenBalance(
  client: PublicClient,
  tokenAddress: Address,
  ownerAddress: Address,
): Promise<bigint> {
  return (await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ownerAddress],
    blockTag: "latest",
  })) as bigint;
}

export async function simulateSwap(
  client: PublicClient,
  params: SimulateSwapParams,
): Promise<SimulationResult> {
  try {
    const preBalance = await getTokenBalance(client, params.tokenOut, params.from);
    const stateOverrides = prepareStateOverrides(params.tokenIn, params.from, params.amountIn);
    const approveData =
      `0x095ea7b3${pad64(params.to)}${pad64(params.amountIn.toString(16))}` as `0x${string}`;
    const balanceOfData = `0x70a08231${pad64(params.from)}` as `0x${string}`;

    const result = await simulateCalls(client, {
      account: params.from,
      calls: [
        {
          // approve(spender, amount)
          to: params.tokenIn,
          data: approveData,
        },
        {
          // perform the swap
          to: params.to,
          data: params.data,
          value: params.value,
        },
        {
          // read post-swap balance
          to: params.tokenOut,
          data: balanceOfData,
        },
      ],
      stateOverrides,
    });

    const approveCall = result.results[0];
    const swapCall = result.results[1];
    const balanceCall = result.results[2];

    if (!approveCall || !swapCall || !balanceCall) {
      return {
        success: false,
        error: "Missing calls in simulation response",
      };
    }

    if (approveCall.status === "failure") {
      return {
        success: false,
        error: `Approval failed: ${approveCall.error?.message || "unknown reason"}`,
      };
    }

    if (swapCall.status === "failure") {
      return {
        success: false,
        error: `Swap reverted: ${swapCall.error?.message || "unknown reason"}`,
      };
    }

    const postBalance = BigInt(balanceCall.data || "0x0");
    const outputAmount = postBalance - preBalance;

    return {
      success: true,
      outputAmount,
      gasUsed: swapCall.gasUsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown simulation error",
    };
  }
}
