import { describe, expect, it, mock } from "bun:test";
import { fabric, zeroX } from "@withfabric/spandex";
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

describe("SpandexProvider", () => {
  it("should provide metaAggregator to children", () => {
    render(<TestComponent />, {
      spandexConfig: {
        providers: [zeroX({ apiKey: "test" }), fabric({ appId: "test" })],
      },
    });

    expect(screen.getByText("MetaAggregator: exists")).toBeDefined();
  });
});
