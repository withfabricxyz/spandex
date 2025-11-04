import type { Address, PublicClient } from "viem";
import { keccak256, toHex } from "viem";
import type { SimulationResult } from "./types";

type AnyPublicClient = Pick<PublicClient, "request" | "readContract">;

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
  const balanceHex = pad64(amount.toString(16));

  return {
    [tokenAddress]: {
      stateDiff: {
        [balanceSlot]: balanceHex,
      },
    },
  };
}

async function getTokenBalance(
  client: AnyPublicClient,
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
  client: AnyPublicClient,
  params: SimulateSwapParams,
): Promise<SimulationResult> {
  // simulate_v1 is only supported by a handful of RPC's; Alchemy, Tenderly, Reth Nodes(?)
  // not supported on most public RPC's or Infura
  // we would need something like this...a less accurate eth_call maybe?
  // if (notSupported) {
  //   return fallbackSimulation(client, params);
  // }
  return ethSimulateV1(client, params);
}

async function ethSimulateV1(
  client: AnyPublicClient,
  params: SimulateSwapParams,
): Promise<SimulationResult> {
  try {
    const preBalance = await getTokenBalance(client, params.tokenOut, params.from);
    const stateOverrides = prepareStateOverrides(params.tokenIn, params.from, params.amountIn);
    const approveData = `0x095ea7b3${pad64(params.to)}${pad64(params.amountIn.toString(16))}`;
    const balanceOfData = `0x70a08231${pad64(params.from)}`;

    const calls = [
      {
        // approve(spender, amount)
        from: params.from,
        to: params.tokenIn,
        data: approveData,
      },
      {
        // perform the swap
        from: params.from,
        to: params.to,
        data: params.data,
        value: params.value ? toHex(params.value) : undefined,
      },
      {
        // read post-swap balance
        to: params.tokenOut,
        data: balanceOfData,
      },
    ];

    const result = await client.request({
      method: "eth_simulateV1",
      params: [
        {
          blockStateCalls: [
            {
              stateOverrides,
              calls,
            },
          ],
          validation: true, // include fees and etc for most accurate representation
        },
        "latest",
      ],
    } as never);

    const blockResult = (result as unknown[])?.[0] as {
      calls?: Array<{
        status?: string;
        returnData?: string;
        gasUsed?: string;
      }>;
    };

    if (!blockResult?.calls || blockResult.calls.length < 3) {
      return {
        success: false,
        error: "Invalid eth_simulateV1 response",
      };
    }

    const approveCall = blockResult.calls[0];
    const swapCall = blockResult.calls[1];
    const balanceCall = blockResult.calls[2];

    if (!approveCall || !swapCall || !balanceCall) {
      return {
        success: false,
        error: "Missing calls in eth_simulateV1 response",
      };
    }

    if (approveCall.status !== "0x1") {
      return {
        success: false,
        error: `Approval failed: ${approveCall.returnData || "unknown reason"}`,
      };
    }

    if (swapCall.status !== "0x1") {
      return {
        success: false,
        error: `Swap reverted: ${swapCall.returnData || "unknown reason"}`,
      };
    }

    const postBalance = BigInt(balanceCall.returnData || "0x0");
    const outputAmount = postBalance - preBalance;

    return {
      success: true,
      outputAmount,
      gasUsed: BigInt(swapCall.gasUsed || "0x0"),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown simulation error",
    };
  }
}
