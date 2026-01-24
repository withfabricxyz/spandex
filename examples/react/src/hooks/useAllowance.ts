/** biome-ignore-all lint/correctness/useHookAtTopLevel: <> */
import type { UseQueryResult } from "@tanstack/react-query";
import { type Address, erc20Abi, ethAddress, zeroAddress } from "viem";
import { useBalance, useReadContract } from "wagmi";

export function useAllowance({
  chainId,
  token,
  spender,
  owner,
}: {
  chainId?: number;
  owner?: Address;
  token?: Address;
  spender?: Address;
}): UseQueryResult<bigint> {
  if (token === zeroAddress || token === ethAddress) {
    return useBalance({
      chainId: chainId,
      address: owner,
      query: {
        enabled: !!owner && !!chainId,
        select: (data) => data.value,
      },
    }) as UseQueryResult<bigint>;
  }

  return useReadContract({
    address: token,
    chainId: chainId,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner as Address, spender as Address],
    query: {
      enabled: !!owner && !!spender && !!token && !!chainId,
    },
  }) as UseQueryResult<bigint>;
}
