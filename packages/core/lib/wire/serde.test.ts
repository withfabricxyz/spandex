import { describe, expect, it } from "bun:test";
import { deserializeWithBigInt, serializeWithBigInt } from "./serde.js";

describe("serde", () => {
  it("encoded and decodes bigint", () => {
    const original = {
      small: BigInt(123),
      large: BigInt("123456789012345678901234567890"),
      nested: {
        value: BigInt(456),
      },
      array: [BigInt(789), BigInt(101112)],
      normal: "test",
      number: 42,
    };

    const unwrapped: typeof original = deserializeWithBigInt(serializeWithBigInt(original));
    expect(unwrapped).toEqual(original);
    expect(typeof unwrapped.small).toBe("bigint");
    expect(typeof unwrapped.large).toBe("bigint");
    expect(typeof unwrapped.nested.value).toBe("bigint");
    expect(typeof unwrapped.array[0]).toBe("bigint");
    expect(typeof unwrapped.array[1]).toBe("bigint");
  });
});
