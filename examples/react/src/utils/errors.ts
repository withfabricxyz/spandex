import { type Chain, decodeErrorResult, erc20Abi, type Hex } from "viem";
import type { TokenMetadata } from "@/services/tokens";
import { parseTokenValue } from "./strings";

export type StructuredError = {
  title: string;
  description?: string;
  details?: string;
  cause: unknown;
};

export type SwapErrorCategory = "connection" | "input" | "quote" | "simulation" | "transaction";

export type SwapErrorState = Record<SwapErrorCategory, StructuredError[]>;

export function validateSwapInput(
  amount: string,
  balance?: bigint,
  sellToken?: TokenMetadata,
  buyToken?: TokenMetadata,
): StructuredError[] | null {
  const inputErrors: StructuredError[] = [];

  if (!sellToken || !buyToken) {
    inputErrors.push({ title: "Invalid token", cause: "invalid-token" });
  }

  if (sellToken?.address === buyToken?.address) {
    inputErrors.push({ title: "Invalid token pair", cause: "invalid-token-pair" });
  }

  if (!amount || amount.trim() === "") {
    inputErrors.push({ title: "Enter an amount", cause: "empty" });
  }

  const parsed = Number(amount);
  if (Number.isNaN(parsed) || parsed <= 0) {
    inputErrors.push({ title: "Invalid amount", cause: "invalid" });
  }

  if (balance !== undefined && sellToken?.decimals !== undefined) {
    const inputAmount = parseTokenValue(amount, sellToken?.decimals);
    if (inputAmount > balance) {
      inputErrors.push({ title: "Insufficient balance", cause: "balance" });
    }
  }

  return inputErrors;
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
      title: `Insufficient funds ${
        chain?.name ? `on ${chain?.name}` : ""
      } to complete this transaction.`,
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
