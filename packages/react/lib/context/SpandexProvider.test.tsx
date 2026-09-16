import { beforeEach, describe, expect, it, mock } from "bun:test";
import { nordstern, zeroX } from "@spandex/core";
import { createClient, http } from "viem";
import { base } from "viem/chains";
import { render, screen } from "../../test/utils.js";
import { useSpandexConfig } from "./SpandexProvider.js";

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
  beforeEach(() => {
    // Other hook tests replace wagmi exports; reset the client for every test.
    // Use a bare client so this suite actually verifies publicActions decoration.
    const client = createClient({ chain: base, transport: http("https://base.drpc.org") });
    mock.module("wagmi", () => ({
      useConfig: () => ({
        getClient: ({ chainId }: { chainId: number }) => (chainId === base.id ? client : undefined),
      }),
      useConnection: () => ({ address: undefined, chain: undefined }),
    }));
  });

  it("should provide metaAggregator to children", () => {
    render(<TestComponent />, {
      spandexConfig: {
        providers: [zeroX({ apiKey: "test" }), nordstern({})],
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
        providers: [nordstern({})],
      },
    });

    expect(screen.getByText("readContract: yes")).toBeDefined();
  });
});
