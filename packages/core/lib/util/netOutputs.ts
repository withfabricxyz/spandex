import { type Address, decodeEventLog, erc20Abi, type Log } from "viem";
import type { SwapParams, TransferData } from "../types.js";

export type Allocations = {
  inputToken: Map<Address, bigint>;
  outputToken: Map<Address, bigint>;
};

/**
 * Extracts net input and output token allocations from a list of transfers. Used to determine fee taking and final swap amount for the swapper.
 *
 * @note this function is currently considered experimental and may result in inaccurate calculations for complex swaps.
 *
 * @param param swap - The swap parameters
 * @param param transfers - The list of transfer data from the simulation or execution
 * @param param router - The router address
 *
 * @returns Allocations - A mapping of input and output token allocations per address
 */
export function netOutputs({ swap, logs }: { swap: SwapParams; logs: Log[] }): Allocations {
  const transfers = extractSimpleTransfers(logs, swap.swapperAccount);
  const outputs = outputTransfers({
    transfers,
    swapper: swap.swapperAccount,
  });

  const allocations: Allocations = {
    inputToken: new Map<Address, bigint>(),
    outputToken: new Map<Address, bigint>(),
  };

  for (const transfer of outputs) {
    const token = transfer.token.toLowerCase() as Address;
    const recipient = transfer.to.toLowerCase() as Address;
    if (token === swap.outputToken.toLowerCase()) {
      allocations.outputToken.set(
        recipient,
        (allocations.outputToken.get(recipient) || 0n) + transfer.value,
      );
    } else if (token === swap.inputToken.toLowerCase()) {
      allocations.inputToken.set(
        recipient,
        (allocations.inputToken.get(recipient) || 0n) + transfer.value,
      );
    }
  }

  return allocations;
}

/// --- Helpers --- ///

const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function extractTransfers(logs: Log[]): TransferData[] {
  return logs
    .map((log) => {
      if (log.topics[0]?.toLowerCase() !== TRANSFER_EVENT_TOPIC) {
        return null;
      }
      try {
        const decoded = decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "Transfer") {
          return {
            index: log.logIndex || 0,
            token: log.address,
            from: decoded.args.from,
            to: decoded.args.to,
            value: decoded.args.value,
          };
        }
      } catch {}
      return null;
    })
    .filter((t) => t !== null);
}

function extractEventSourcesNonTransfer(logs: Log[], executors: Set<Address>): Set<Address> {
  const sources: Set<Address> = new Set();
  for (const log of logs) {
    if (log.topics[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC) continue;
    if (executors.has(log.address.toLowerCase() as Address)) continue;
    sources.add(log.address.toLowerCase() as Address);
  }
  return sources;
}

function extractSimpleTransfers(logs: Log[], swapper: Address): TransferData[] {
  const transfers: TransferData[] = extractTransfers(logs);
  const executorCandidates = transfers
    .filter((t) => t.to.toLowerCase() === swapper.toLowerCase())
    .map((t) => t.from.toLowerCase() as Address)
    .reduce((acc, curr) => {
      acc.add(curr);
      return acc;
    }, new Set<Address>());

  const nonTransferSources = extractEventSourcesNonTransfer(logs, executorCandidates);
  // Filter out transfers involving contracts that emitted other events
  return transfers.filter(
    (t) =>
      !nonTransferSources.has(t.from.toLowerCase() as Address) &&
      !nonTransferSources.has(t.to.toLowerCase() as Address),
  );
}

function outputTransfers({
  transfers,
  swapper,
}: {
  transfers: TransferData[];
  swapper: Address;
}): TransferData[] {
  const nonSwapper = transfers.filter((t) => t.from.toLowerCase() !== swapper.toLowerCase());
  // Filter out obvious DEX swaps
  return transfers.filter((out) => {
    const matchInbound = nonSwapper.find((inb) => inb.from.toLowerCase() === out.to.toLowerCase());
    return !matchInbound;
  });
}
