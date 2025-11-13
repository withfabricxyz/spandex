import type { QuoteTxData } from "@withfabric/smal";
import type { Address, PublicClient } from "viem";
import { encodeFunctionData, erc20Abi, zeroAddress } from "viem";
import { simulateCalls } from "viem/actions";
import type { SimulationResult } from "./SimulatedMetaAggregator/types.js";

type SimulateSwapParams = QuoteTxData & {
  from: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  stateOverrides?: unknown[];
  balanceOverride?: bigint;
};

// TODO: Fetch output balance once for a batch of simulations to reduce RPC calls
// TODO: Fetch storage slot once for a batch of simulations to reduce RPC calls
// TODO: Iterate over multiple possible storage by poking storage slots until balance matches
// TODO: Consider supporting "real" user token and not adjusting balance for real-world impls
// TODO: ETH as input or output requires different handling for balance IO

// TODO: maybe offload state overrides to caller. assume that any given address is able to perform swap and throw if revert?
// ie, is it our responsibility to ensure sufficient simulated balance/allowance?
// function getBalanceStorageSlot(userAddress: Address, slot = 0): `0x${string}` {
//   const paddedSlot = pad(`0x${slot.toString(16)}`, { size: 64 });
//   const paddedAddress = pad(`0x${userAddress.slice(2)}`, { size: 64 });
//   const concatenated = `0x${paddedAddress}${paddedSlot}` as `0x${string}`;
//   return keccak256(concatenated);
// }

// function prepareStateOverrides(tokenAddress: Address, userAddress: Address, amount: bigint) {
//   const balanceSlot = getBalanceStorageSlot(userAddress, 0);
//   const balanceHex = `${pad(`0x${amount.toString(16)}`, { size: 32 })}` as `0x${string}`;

//   return [
//     {
//       address: tokenAddress,
//       stateDiff: [
//         {
//           slot: balanceSlot,
//           value: balanceHex,
//         },
//       ],
//     },
//     // need eth for gas
//     {
//       address: userAddress,
//       balance: parseEther("10000"), // large amount to cover gas costs + swap value
//     },
//   ];
// }

export async function simulateSwap(
  client: PublicClient,
  params: SimulateSwapParams,
): Promise<SimulationResult> {
  try {
    const isERC20In = params.tokenIn !== zeroAddress;
    const isERC20Out = params.tokenOut !== zeroAddress;
    // const stateOverrides = prepareStateOverrides(params.tokenIn, params.from, params.amountIn);

    // number and order of calls depends on whether tokenIn and tokenOut are ERC20 or native
    const calls = [];

    let approveIdx: number | null = null;
    let swapIdx: number = 0;
    let balanceIdx: number | null = null;

    // if ERC20 in, approve first
    if (isERC20In) {
      approveIdx = 0;

      calls.push({
        to: params.tokenIn,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [params.to, params.amountIn],
        }),
        value: undefined,
      });
    }

    // swap always gets called
    swapIdx = calls.length;

    calls.push({
      to: params.to,
      data: params.data,
      value: params.value,
    });

    // if ERC20 out, call balanceOf after swap so that the asset gets "touched" and is tracked in assetChanges
    // ERC20's don't otherwise get included in the assetResults list - i'm not sure why, something to do with to/from/spender?
    // perhaps there's a better way for us to check ERC20 output balance?
    if (isERC20Out) {
      balanceIdx = calls.length;

      calls.push({
        to: params.tokenOut,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [params.from],
        }),
        value: undefined,
      });
    }

    const result = await simulateCalls(client, {
      account: params.from,
      calls,
      // stateOverrides,
      traceAssetChanges: true,
    });

    if (approveIdx !== null && result.results[approveIdx]?.status !== "success") {
      const approveError = result.results[approveIdx]?.error;
      return {
        success: false,
        error:
          approveError instanceof Error
            ? approveError.message
            : approveError || "Approval failed during simulation",
      };
    }

    if (result.results[swapIdx]?.status === "failure") {
      const swapError = result.results[swapIdx]?.error;
      return {
        success: false,
        error:
          swapError instanceof Error
            ? swapError.message
            : swapError || "Swap failed during simulation",
      };
    }

    if (balanceIdx !== null && result.results[balanceIdx]?.status !== "success") {
      const balanceError = result.results[balanceIdx]?.error;
      return {
        success: false,
        error:
          balanceError instanceof Error
            ? balanceError.message
            : balanceError || "Balance check failed during simulation",
      };
    }

    const nativeAddr = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"; // this not being zeroAddress in the assetChanges list had me stuck for a while
    const outputAssetAddress = !isERC20Out ? nativeAddr : params.tokenOut;
    const outputAsset = result.assetChanges.find(
      (asset) => asset.token.address.toLowerCase() === outputAssetAddress.toLowerCase(),
    );

    const postBalance = outputAsset?.value.diff ?? 0n;
    const gasUsed = result.results[swapIdx]?.gasUsed;

    return {
      success: true,
      outputAmount: postBalance,
      callsResults: result.results,
      gasUsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown simulation error",
    };
  }
}
