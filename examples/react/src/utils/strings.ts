type AddressFormatOpts = {
  truncate: boolean;
};

type TokenFormatOpts = {
  precision?: number;
};

export const formatAddress = (address: string, opts: AddressFormatOpts = { truncate: true }) => {
  if (address == null) {
    return "0x0";
  }

  if (!opts.truncate) return address;

  return `${address.substring(0, 5)}...${address.slice(address.length - 4)}`;
};

function stripTrailingZeros(value: string): string {
  return value.replace(/(\.[0-9]*[1-9])0+$/, "$1").replace(/\.$/, "");
}

function formatNumberFancy(value: number): string {
  if (value === 0) {
    return "0";
  }
  if (value >= 1_000_000) {
    return formatLargishValue(value);
  }
  if (value >= 10) {
    return value.toFixed(0);
  }
  if (value >= 1) {
    return value.toFixed(2);
  }
  if (value < 0.0000001) {
    return "<0.0000001";
  }
  return stripTrailingZeros(value.toFixed(8));
}

function formatLargishValue(num: number): string {
  const digits = 1;
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "K" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "B" },
  ];
  const item = lookup
    .slice()
    .reverse()
    .find((item) => num >= item.value);
  return item ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol : "0";
}

export function formatTokenValue(
  amount: bigint,
  decimals: number,
  options?: TokenFormatOpts,
): string {
  const value = Number(amount) / 10 ** decimals;

  if (options?.precision) return formatNumberFancy(Number(value.toPrecision(options.precision)));

  return formatNumberFancy(value);
}

export function parseTokenValue(value: string, decimals: number): bigint {
  if (!value || value === "" || value === ".") return 0n;

  const parts = value.trim().split(".");

  if (parts.length > 2) return 0n;

  const integerPart = parts[0] || "0";
  const decimalPart = parts[1] || "";

  const paddedDecimalPart = decimalPart.padEnd(decimals, "0").slice(0, decimals);
  const combinedValue = integerPart + paddedDecimalPart;

  try {
    return BigInt(combinedValue);
  } catch {
    return 0n;
  }
}

export function bigintToDecimalString(amount: bigint, decimals: number): string {
  if (amount === 0n) return "0";

  const amountStr = amount.toString();

  // Pad with zeros if needed
  const paddedAmount = amountStr.padStart(decimals + 1, "0");

  // Split into integer and decimal parts
  const integerPart = paddedAmount.slice(0, -decimals) || "0";
  const decimalPart = paddedAmount.slice(-decimals);

  // Remove trailing zeros from decimal part
  const trimmedDecimal = decimalPart.replace(/0+$/, "");

  if (trimmedDecimal === "") {
    return `${integerPart}`;
  }

  return `${integerPart}.${trimmedDecimal}`;
}
