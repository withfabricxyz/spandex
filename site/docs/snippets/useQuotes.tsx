import { useQuotes } from "@withfabric/spandex-react";

export function App() {
  const { data, isLoading, error } = useQuotes({
    swap: {
      inputToken: "0x4200000000000000000000000000000000000006", // WETH
      outputToken: "0xd9AAEC86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC
      mode: "exactIn",
      inputAmount: 1_000_000_000_000_000_000n, // 1 WETH
      slippageBps: 50, // Tolerance
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Quotes</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
