import { createFileRoute } from "@tanstack/react-router";
import { IntentCapture } from "@/components/IntentCapture";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return <IntentCapture />;
}
