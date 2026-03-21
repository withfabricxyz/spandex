import { type Address, ethAddress, zeroAddress } from "viem";
import type { SwapParams } from "../types.js";

const NATIVE_TOKENS = new Set([zeroAddress.toLowerCase(), ethAddress.toLowerCase()]);

export function isNativeToken(address: Address): boolean {
  return NATIVE_TOKENS.has(address.toLowerCase());
}

export function isCrossChain(params: SwapParams): boolean {
  return params.outputChainId !== undefined && params.outputChainId !== params.chainId;
}
