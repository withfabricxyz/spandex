import type { Hash, PublicClient, WalletClient } from "viem";
import { type BuiltCall, buildCalls } from "./buildCalls.js";
import type { Config } from "./createConfig.js";
import type { SimulatedQuote, SwapParams } from "./types.js";

/**
 * Error thrown when quote execution fails or cannot be attempted.
 */
export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

export type ExecuteQuoteParams = {
  swap: SwapParams;
  quote: SimulatedQuote;
  walletClient: WalletClient;
  publicClient?: PublicClient;
  config: Config;
};

export type ExecutedQuoteReturnType = {
  transactionHash: Hash;
};

/**
 * Executes a simulated quote by sending the required approval and swap transactions.
 *
 * Uses EIP-5792 batch calls when supported by the wallet, otherwise falls back to sequential
 * transactions and waits for receipts.
 *
 * @param params - Parameters for executing the quote.
 * @param params.swap - Swap parameters used to construct the calls.
 * @param params.quote - Simulated quote to execute (must be successful).
 * @param params.config - Meta-aggregator configuration used to resolve clients and options.
 * @param params.walletClient - Wallet client used to sign and send transactions.
 * @param params.publicClient - Optional public client for reading chain data and receipts.
 * @returns The executed quote result containing the transaction hash.
 * @throws ExecutionError - When the wallet chain mismatches, the quote is unsuccessful, or execution fails.
 */
export async function executeQuote({
  swap,
  quote,
  config,
  walletClient,
  publicClient,
}: ExecuteQuoteParams): Promise<ExecutedQuoteReturnType> {
  if (swap.chainId !== walletClient.chain?.id) {
    throw new ExecutionError(
      `Client chain ID ${walletClient.chain?.id} does not match swap chain ID ${swap.chainId}`,
    );
  }

  if (!quote.success || !quote.simulation.success) {
    throw new ExecutionError("Selected quote is not successful");
  }

  const isBatch = await isBatchSupported(walletClient);

  // Determine calls to execute (approval? + swap)
  const calls = await buildCalls({
    quote,
    swap,
    config,
    publicClient,
    allowanceMode: isBatch ? "exact" : "unlimited",
  });

  let transactionHash: Hash | null = null;
  if (isBatch) {
    transactionHash = await executeAtomic({ calls, swap, walletClient });
  } else {
    const client = publicClient || config.clientLookup(swap.chainId);
    if (!client) {
      throw new ExecutionError(`No public client available for chain ID ${swap.chainId}`);
    }

    transactionHash = await executeSequential({
      calls,
      swap,
      walletClient,
      publicClient: client,
    });
  }

  return {
    transactionHash,
  };
}

async function isBatchSupported(client: WalletClient): Promise<boolean> {
  try {
    const capabilities = await client.getCapabilities({ chainId: client.chain?.id || 0 });
    return capabilities.atomic?.status === "supported";
  } catch {
    return false;
  }
}

async function executeAtomic({
  calls,
  swap,
  walletClient,
}: {
  calls: BuiltCall[];
  swap: SwapParams;
  walletClient: WalletClient;
}): Promise<Hash> {
  const { id } = await walletClient.sendCalls({
    chain: walletClient.chain,
    account: swap.swapperAccount,
    calls: calls.map((call) => call.txn),
  });
  const { receipts, status } = await walletClient.waitForCallsStatus({ id });

  const receipt = receipts?.[receipts.length - 1];
  if (receipt === undefined || status !== "success") {
    throw new ExecutionError("Transaction execution failed");
  }

  return receipt.transactionHash;
}

async function executeSequential({
  calls,
  swap,
  walletClient,
  publicClient,
}: {
  calls: BuiltCall[];
  swap: SwapParams;
  walletClient: WalletClient;
  publicClient: PublicClient;
}): Promise<Hash> {
  let lastHash: Hash | null = null;

  for (const call of calls) {
    const hash = await walletClient.sendTransaction({
      chain: walletClient.chain,
      account: swap.swapperAccount,
      ...call.txn,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new ExecutionError("Transaction execution failed");
    }

    lastHash = receipt.transactionHash;
  }

  if (lastHash === null) {
    throw new ExecutionError("No transactions were executed");
  }

  return lastHash;
}
