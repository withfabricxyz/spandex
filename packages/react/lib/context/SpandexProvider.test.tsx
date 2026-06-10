import { describe, expect, it, mock } from "bun:test";
import { fabric, zeroX } from "@spandex/core";
import { render, screen } from "../../test/utils.js";
import { useSpandexConfig } from "./SpandexProvider.js";

mock.module("wagmi", () => ({
  useConnection: () => ({
    address: undefined,
    chain: undefined,
  }),
}));

function TestComponent() {
  const config = useSpandexConfig();
  return <div>MetaAggregator: {config ? "exists" : "missing"}</div>;
}

function ClientProbe({ chainId }: { chainId: number }) {
  const config = useSpandexConfig();
  const client = config.clientLookup(chainId);
  return <div>readContract: {typeof client?.readContract === "function" ? "yes" : "no"}</div>;
}

describe("SpandexProvider", () => {
  it("should provide metaAggregator to children", () => {
    render(<TestComponent />, {
      spandexConfig: {
        providers: [zeroX({ apiKey: "test" }), fabric({ appId: "test" })],
      },
    });

    expect(screen.getByText("MetaAggregator: exists")).toBeDefined();
  });

  // wagmi's getClient returns a bare viem Client; the provider must extend it
  // with publicActions or core's method-style calls (e.g. readContract in
  // buildCalls) throw at execution time
  it("should provide public clients with decorated actions", () => {
    render(<ClientProbe chainId={8453} />, {
      spandexConfig: {
        providers: [fabric({ appId: "test" })],
      },
    });

    expect(screen.getByText("readContract: yes")).toBeDefined();
  });
});
