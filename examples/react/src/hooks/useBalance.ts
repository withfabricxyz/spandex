/** biome-ignore-all lint/correctness/useHookAtTopLevel: <> */
import type { UseQueryResult } from "@tanstack/react-query";
import { type Address, erc20Abi, ethAddress, zeroAddress } from "viem";
import { useBalance as useEthBalance, useReadContract } from "wagmi";

export function useBalance({
  chainId,
  token,
  owner,
}: {
  chainId?: number;
  owner?: Address;
  token?: Address;
}): UseQueryResult<bigint> {
  if (token === zeroAddress || token === ethAddress) {
    return useEthBalance({
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
    functionName: "balanceOf",
    args: [owner as Address],
    query: {
      enabled: !!owner && !!token && !!chainId,
    },
  }) as UseQueryResult<bigint>;
}
