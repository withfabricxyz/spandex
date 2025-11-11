import type { QuoteTxData } from "@withfabric/smal";
import type { Address, PublicClient } from "viem";
import { encodeFunctionData, erc20Abi, keccak256, pad, parseEther } from "viem";
import { simulateCalls } from "viem/actions";
import type { SimulationResult } from "./SimulatedMetaAggregator/types";

type SimulateSwapParams = QuoteTxData & {
  from: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  stateOverrides?: unknown[],
  // stateOverride: bool
  balanceOverride?: bigint;
};

// TODO: Fetch output balance once for a batch of simulations to reduce RPC calls
// TODO: Fetch storage slot once for a batch of simulations to reduce RPC calls
// TODO: Iterate over multiple possible storage by poking storage slots until balance matches
// TODO: Consider supporting "real" user token and not adjusting balance for real-world impls
// TODO: ETH as input or output requires different handling for balance IO

// TODO: scan for correct storage slot? assuming 0 for balance slot - likely differs across contracts
function getBalanceStorageSlot(userAddress: Address, slot = 0): `0x${string}` {
  const paddedSlot = pad(`0x${slot.toString(16)}`, { size: 64 });
  const paddedAddress = pad(`0x${userAddress.slice(2)}`, { size: 64 });
  const concatenated = `0x${paddedAddress}${paddedSlot}` as `0x${string}`;
  return keccak256(concatenated);
}

function prepareStateOverrides(tokenAddress: Address, userAddress: Address, amount: bigint) {
  const balanceSlot = getBalanceStorageSlot(userAddress, 0);
  const balanceHex = `${pad(`0x${amount.toString(16)}`, { size: 32 })}` as `0x${string}`;

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
    // need eth for gas
    {
      address: userAddress,
      balance: parseEther("10000"), // large amount to cover gas costs + swap value
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
    abi: erc20Abi,
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
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [params.to, params.amountIn],
    });
    const balanceOfData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [params.from],
    });

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
      traceAssetChanges: true,
    });

    const approveResult = result.results[0];
    const swapResult = result.results[1];
    const balanceResult = result.results[2];

    if (!approveResult || !swapResult || !balanceResult) {
      return {
        success: false,
        error: "Missing calls in simulation response",
      };
    }

    if (approveResult.status === "failure") {
      return {
        success: false,
        error: `Approval failed: ${approveResult.error?.message || "unknown reason"}`,
      };
    }

    if (swapResult.status === "failure") {
      return {
        success: false,
        error: `Swap reverted: ${swapResult.error?.message || "unknown reason"}`,
      };
    }

    if (balanceResult.status === "failure") {
      return {
        success: false,
        error: `Balance read reverted: ${balanceResult.error?.message || "unknown reason"}`,
      };
    }

    if ((balanceResult.logs?.length || 0) > 0) {
      console.error("Balance call reverted with logs:", balanceResult.logs);
    }

    const postBalance = BigInt(balanceResult.data || "0x0");
    const outputAmount = postBalance - preBalance;

    console.log(result.assetChanges);

    return {
      success: true,
      outputAmount,
      callsResults: result.results,
      gasUsed: swapResult.gasUsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown simulation error",
    };
  }
}
