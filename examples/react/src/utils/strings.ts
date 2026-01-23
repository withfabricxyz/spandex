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
