import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export const TEST_ADDRESSES = {
  alice: "0x1234567890123456789012345678901234567890" as const,
  bob: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const,
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
  weth: "0x4200000000000000000000000000000000000006" as const,
} as const;

export const TEST_CHAINS = {
  base: { id: 8453, name: "Base" },
  mainnet: { id: 1, name: "Ethereum" },
} as const;
