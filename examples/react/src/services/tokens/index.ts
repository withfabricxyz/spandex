import type { Address } from "viem";

export type TokenId = {
  chainId: number;
  address: Address;
};

export type TokenMetadata = TokenId & {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  usdPriceCents: number;
  change24h: number;
  risk?: number;
  tags?: string[];
};
