const BIGINT_PREFIX = "__bigint__:";
const BIGINT_VALUE = /^-?\d+$/;

/**
 * Serialize an item to JSON, converting bigint values to a string format.
 *
 * Note: One must use the corresponding deserializeWithBigInt function to properly restore bigint values.
 *
 * @param item The item to serialize as JSON with bigint support
 *
 * @returns The serialized JSON string
 */
export function serializeWithBigInt<T>(item: T): string {
  return JSON.stringify(item, (_key, value) => {
    if (typeof value === "bigint") {
      return `${BIGINT_PREFIX}${value.toString()}`;
    }
    return value;
  });
}

/**
 * Deserialize a JSON string to an item, converting bigint strings back to bigint values
 *
 * @param payload The JSON string to deserialize
 *
 * @returns The deserialized item with bigint support
 */
export function deserializeWithBigInt<T>(payload: string): T {
  return JSON.parse(payload, (_key, value) => {
    if (typeof value === "string" && value.startsWith(BIGINT_PREFIX)) {
      const raw = value.slice(BIGINT_PREFIX.length);
      if (raw.length > 0 && BIGINT_VALUE.test(raw)) {
        return BigInt(raw);
      }
    }
    return value;
  });
}
