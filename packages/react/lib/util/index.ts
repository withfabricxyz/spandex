const BIGINT_KEY = "__bigint__";

export const bigintReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? { [BIGINT_KEY]: value.toString() } : value;

export const bigintReviver = (_key: string, value: unknown) => {
  if (value && typeof value === "object" && BIGINT_KEY in value) {
    const stored = (value as Record<string, unknown>)[BIGINT_KEY];
    if (typeof stored === "string") {
      return BigInt(stored);
    }
  }
  return value;
};
