import { encodeFunctionData, erc20Abi } from "viem";
import type { Config } from "./createConfig.js";
import type { SuccessfulQuote, SwapParams, TxData } from "./types.js";

/**
 * A built call, representing either an approval or a swap transaction.
 */
export type BuiltCall = {
  /** The type of call, either an approval or a swap. */
  type: "approval" | "swap";
  /** The transaction data for the call. */
  txn: TxData;
};

export type BuildCallsParams = {
  /** The quote for the swap. */
  quote: SuccessfulQuote;
  /** The parameters for the swap. */
  swap: SwapParams;
  /** The configuration (required for onchain calls). */
  config: Config;
  /** The allowance mode for approvals. Exact amount for swap or unlimited to reduce future approvals. */
  allowanceMode?: "unlimited" | "exact";
  /** Whether to force the approval call without checking allowance. */
  force?: boolean;
};

/**
 * Build array of calls (approval + swap) needed to execute the given swap quote.
 *
 * @param params - Parameters for building calls.
 * @returns Array of built calls (type and transaction data).
 */
export async function buildCalls(params: BuildCallsParams): Promise<BuiltCall[]> {
  const calls: BuiltCall[] = [];

  const approval = await getApprovalCall(params);
  if (approval) {
    calls.push({
      type: "approval",
      txn: approval,
    });
  }

  calls.push({
    type: "swap",
    txn: params.quote.txData,
  });

  return calls;
}

async function getApprovalCall({
  quote,
  swap,
  config,
  allowanceMode = "exact",
  force = false,
}: BuildCallsParams): Promise<TxData | null> {
  if (quote.approval === undefined) {
    return null;
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [
      quote.approval.spender,
      allowanceMode === "unlimited"
        ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        : quote.inputAmount,
    ],
  });

  // Logic to determine if approval is needed and return the approval call
  const result = {
    to: quote.approval.token,
    data,
  };

  if (force) {
    return result;
  }

  // Check the allowance onchain to see if approval is necessary
  const client = config.clientLookup(swap.chainId);
  if (!client) {
    throw new Error(`No client available for chain ID ${swap.chainId}`);
  }

  const allowance = await client.readContract({
    address: quote.approval.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [swap.swapperAccount, quote.approval.spender],
  });

  if (allowance < quote.inputAmount) {
    return result;
  }

  return null;
}
