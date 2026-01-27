import { type Chain, decodeErrorResult, erc20Abi, type Hex } from "viem";
import { parseTokenValue } from "./strings";

export type StructuredError = {
  title: string;
  description?: string;
  details?: string;
  cause: unknown;
};

export type SwapErrorCategory = "connection" | "input" | "quote" | "simulation" | "transaction";

export type SwapErrorState = Partial<Record<SwapErrorCategory, StructuredError>>;

export function validateSwapInput(
  amount: string,
  balance?: bigint,
  decimals?: number,
): StructuredError | null {
  if (!amount || amount.trim() === "") {
    return { title: "Enter an amount", cause: "empty" };
  }

  const parsed = Number(amount);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return { title: "Invalid amount", cause: "invalid" };
  }

  if (balance !== undefined && decimals !== undefined) {
    const inputAmount = parseTokenValue(amount, decimals);
    if (inputAmount > balance) {
      return { title: "Insufficient balance", cause: "balance" };
    }
  }

  return null;
}

const abis = [/*executorAbi, swapIntentProtocolAbi, */ erc20Abi];

function tryDecodeCustomError(data: Hex): string | undefined {
  for (const abi of abis) {
    try {
      const decoded = decodeErrorResult({
        abi,
        data,
      });
      if (decoded) {
        return decoded.errorName;
      }
    } catch (_e) {}
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
function structureViemError(error: any, chain?: Chain): StructuredError {
  const customMatch = error.details.match(/custom error ([^$]+)$/i);
  if (customMatch) {
    const mapped = tryDecodeCustomError(customMatch[1]);
    if (mapped) {
      return {
        title: mapped,
        description: mapped,
        details: error.details,
        cause: error,
      };
    }
  }

  if (error.shortMessage.match(/exceeds the balance/i)) {
    return {
      title: `Insufficient funds ${chain?.name ? `on ${chain?.name}` : ""} to complete this transaction.`,
      cause: error,
    };
  }

  const evmError = error.cause?.data?.abiItem?.name;

  return {
    title: error.shortMessage + (evmError ? ` Contract Error: ${evmError}` : ""),
    description: error.details,
    details: error.message,
    cause: error,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: <>
export function structureError(error: any, chain?: Chain): StructuredError {
  if (error.message?.includes("viem")) {
    return structureViemError(error, chain);
  }

  if (typeof error === "string") {
    return {
      title: error,
      cause: error,
    };
  }

  return {
    title: error.message || "Unknown error",
    cause: error,
  };
}
