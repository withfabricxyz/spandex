import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SmalProvider, useSmalConfig } from "./SmalProvider.js";

// Mock Wagmi - not needed by provider anymore
mock.module("wagmi", () => ({
  useConnection: () => ({
    address: undefined,
    chain: undefined,
  }),
}));

function TestComponent() {
  const { metaAggregator } = useSmalConfig();
  return <div>MetaAggregator: {metaAggregator ? "exists" : "missing"}</div>;
}

describe("SmalProvider", () => {
  it("should provide metaAggregator to children", () => {
    render(
      <SmalProvider
        config={{
          aggregators: [
            { provider: "fabric", config: {} },
            { provider: "0x", config: { apiKey: "test" } },
          ],
          defaults: { strategy: "quotedPrice" },
        }}
      >
        <TestComponent />
      </SmalProvider>,
    );

    expect(screen.getByText("MetaAggregator: exists")).toBeDefined();
  });

  it("should throw error when useSmalConfig is used outside provider", () => {
    expect(() => {
      render(<TestComponent />);
    }).toThrow("useSmalConfig must be used within a SmalProvider");
  });
});
