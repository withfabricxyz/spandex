import { formatUnits } from "viem";

export function average(values: number[]): number | undefined {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return undefined;
  }
  const sum = filtered.reduce((acc, value) => acc + value, 0);
  return sum / filtered.length;
}

export function amountToNumber(amount: bigint, decimals?: number): number | null {
  if (decimals === undefined) {
    return null;
  }
  const formatted = formatUnits(amount, decimals);
  const value = Number(formatted);
  if (!Number.isFinite(value) || value === 0) {
    return null;
  }
  return value;
}

export function computeUsdValue(
  amount: bigint,
  decimals: number | undefined,
  usdPrice: number | undefined,
): number | undefined {
  if (usdPrice === undefined) {
    return undefined;
  }
  const normalized = amountToNumber(amount, decimals);
  if (normalized === null) {
    return undefined;
  }
  return usdPrice * normalized;
}

export function computeUsdPriceFromValue(
  amount: bigint,
  decimals: number | undefined,
  usdValue: number | undefined,
): number | undefined {
  if (usdValue === undefined) {
    return undefined;
  }
  const normalized = amountToNumber(amount, decimals);
  if (normalized === null) {
    return undefined;
  }
  return usdValue / normalized;
}
