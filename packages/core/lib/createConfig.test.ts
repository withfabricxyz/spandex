import { describe, expect, it } from "bun:test";
import { createConfig } from "./createConfig.js";

describe("createConfig", () => {
  it("throws on misconfiguration", async () => {
    expect(() => {
      createConfig({
        providers: {},
      });
    }).toThrow();
  });

  it("supports manual configuration", async () => {
    const config = createConfig({
      providers: {
        "0x": {
          apiKey: "test",
        },
      },
    });

    expect(config).toBeDefined();
    expect(config.aggregators.length).toEqual(1);
    expect(config.aggregators[0]?.name()).toEqual("0x");
  });
});
