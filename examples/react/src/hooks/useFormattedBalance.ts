import type { Address } from "viem";
import { formatTokenValue } from "@/utils/strings";
import { useBalance } from "./useBalance";

type UseFormattedBalanceProps = {
  chainId?: number;
  address?: Address;
  tokenAddress?: Address;
  decimals: number;
};

export function useFormattedBalance({
  chainId,
  address,
  tokenAddress,
  decimals,
}: UseFormattedBalanceProps) {
  const { data, isLoading } = useBalance({ chainId, owner: address, token: tokenAddress });

  return {
    balance: data,
    formatted: formatTokenValue(BigInt(data || "0"), decimals),
    isLoading,
  };
}
