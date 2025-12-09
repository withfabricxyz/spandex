import { createFileRoute } from "@tanstack/react-router";
import { IntentCapture } from "@/components/IntentCapture";
import { SUPPORTED_BASE_TOKENS } from "@/constants/tokens";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <IntentCapture
      // biome-ignore lint/style/noNonNullAssertion: <>
      sellToken={SUPPORTED_BASE_TOKENS.find((t) => t.symbol === "USDC")!}
      // biome-ignore lint/style/noNonNullAssertion: <>
      buyToken={SUPPORTED_BASE_TOKENS.find((t) => t.symbol === "WETH")!}
    />
  );
}
