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

export type TokenDetail = TokenMetadata & {
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
};

export type TokenApproval = {
  chainId: number;
  tokenAddress: Address;
  spenderAddress: Address;
  amount: bigint;
};

export type TokenWithBalance = {
  token: TokenMetadata;
  balance: bigint;
};
