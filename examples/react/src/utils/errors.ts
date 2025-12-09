import { type Chain, decodeErrorResult, erc20Abi, type Hex } from "viem";
import { executorAbi } from "@/contracts/executor";
import { swapIntentProtocolAbi } from "@/contracts/sip";

export type StructuredError = {
  title: string;
  description?: string;
  details?: string;
  cause: unknown;
  soft?: boolean;
};

const abis = [executorAbi, swapIntentProtocolAbi, erc20Abi];

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
      soft: true,
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
