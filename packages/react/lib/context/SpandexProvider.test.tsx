import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "../../test/utils.js";
import { useSpandexConfig } from "./SpandexProvider.js";

mock.module("wagmi", () => ({
  useConnection: () => ({
    address: undefined,
    chain: undefined,
  }),
}));

function TestComponent() {
  const { metaAggregator } = useSpandexConfig();
  return <div>MetaAggregator: {metaAggregator ? "exists" : "missing"}</div>;
}

describe("SpandexProvider", () => {
  it("should provide metaAggregator to children", () => {
    render(<TestComponent />, {
      spandexConfig: {
        providers: {
          "0x": { apiKey: "test" },
          fabric: {},
        },
        options: { strategy: "quotedPrice" },
      },
    });

    expect(screen.getByText("MetaAggregator: exists")).toBeDefined();
  });
});
