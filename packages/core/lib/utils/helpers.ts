import { type Address, ethAddress, zeroAddress } from "viem";

const NATIVE_TOKENS = new Set([zeroAddress.toLowerCase(), ethAddress.toLowerCase()]);

export function isNativeToken(address: Address): boolean {
  return NATIVE_TOKENS.has(address.toLowerCase());
}
