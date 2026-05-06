import { describe, expect, it } from "bun:test";
import { zeroX } from "./aggregators/0x.js";
import { createConfig } from "./createConfig.js";

describe("createConfig", () => {
  it("throws on misconfiguration", async () => {
    expect(() => {
      createConfig({
        providers: [],
      });
    }).toThrow();
  });

  it("supports manual configuration", async () => {
    const config = createConfig({
      providers: [zeroX({ apiKey: "test" })],
    });

    expect(config).toBeDefined();
    expect(config.aggregators.length).toEqual(1);
    expect(config.aggregators[0]?.name()).toEqual("0x");
  });

  it("supports dynamic integrator fee configuration", async () => {
    const config = createConfig({
      providers: [zeroX({ apiKey: "test" })],
      options: {
        integratorFeeFn: async () => ({
          feeAddress: "0xFee00000000000000000000000000000000000fee",
          swapFeeBps: 20,
        }),
      },
    });

    expect(config.options.integratorFeeFn).toBeDefined();
  });

  it("throws when dynamic and static fee options are combined", async () => {
    expect(() => {
      createConfig({
        providers: [zeroX({ apiKey: "test" })],
        options: {
          integratorFeeFn: async () => ({
            feeAddress: "0xFee00000000000000000000000000000000000fee",
            swapFeeBps: 20,
          }),
          integratorSwapFeeBps: 20,
        } as never,
      });
    }).toThrow(/cannot be combined/);
  });
});
