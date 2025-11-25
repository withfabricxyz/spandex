import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "../../test/utils.js";
import { useSmalConfig } from "./SmalProvider.js";

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
    render(<TestComponent />, {
      smalConfig: {
        aggregators: [
          { provider: "fabric", config: {} },
          { provider: "0x", config: { apiKey: "test" } },
        ],
        defaults: { strategy: "quotedPrice" },
      },
    });

    expect(screen.getByText("MetaAggregator: exists")).toBeDefined();
  });
});
