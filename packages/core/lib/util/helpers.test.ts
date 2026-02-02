import { describe, expect, it } from "bun:test";
import { isNativeToken } from "./helpers.js";

describe("helpers", () => {
  it("isNativeToken", () => {
    expect(isNativeToken("0x0000000000000000000000000000000000000000")).toBe(true);
    expect(isNativeToken("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE")).toBe(true);
    expect(isNativeToken("0xeeeeeeeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeeeee")).toBe(true);
    expect(isNativeToken("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
  });
});
