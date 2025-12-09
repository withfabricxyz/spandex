import type { TokenMetadata } from "../services/tokens";

type AddressFormatOpts = {
  truncate: boolean;
};

type TokenFormatOpts = {
  precision?: number;
};

export const formatCents = (value: number) => {
  if (value > 1000 || value === 0) {
    return `$${Math.round(value / 100)}`;
  }
  return `$${(value / 100).toFixed(2)}`;
};

export const formatAddress = (address: string, opts: AddressFormatOpts = { truncate: true }) => {
  if (address == null) {
    return "0x0";
  }

  if (!opts.truncate) return address;

  return `${address.substring(0, 5)}...${address.slice(address.length - 4)}`;
};

export const ensOrShortAddr = (addr: string, opts: AddressFormatOpts = { truncate: true }) => {
  return addr.match(/^0x[a-fA-F0-9]{40}$/) ? formatAddress(addr, opts) : addr;
};

const MS_PER_SEC = 1000;
const MS_PER_MIN = MS_PER_SEC * 60;
const MS_PER_HOUR = MS_PER_MIN * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_MONTH = MS_PER_DAY * 30;

function durationParts(ms: number, omitZero?: boolean): string[] {
  const parts: string[] = [];
  let remainingMs = ms;

  function append(dur: number, window: number, suffix: string, zero = true): number {
    if (dur >= window) {
      parts.push(`${String(Math.floor(dur / window)).padStart(2, "0")}${suffix}`);
      return dur % window;
    }
    if (zero && !omitZero) {
      parts.push(`00${suffix}`);
    }
    return dur;
  }

  remainingMs = append(remainingMs, MS_PER_MONTH, "mo");
  remainingMs = append(remainingMs, MS_PER_DAY, "d");
  remainingMs = append(remainingMs, MS_PER_HOUR, "h");
  remainingMs = append(remainingMs, MS_PER_MIN, "m");

  if (parts.length < 4) {
    // exclude seconds if we already have 4 parts
    append(remainingMs, MS_PER_SEC, "s");
  }
  return parts;
}

function durationPartsLong(ms: number, omitZero?: boolean): string[] {
  const parts: string[] = [];
  const append = (dur: number, window: number, suffix: string, zero = true): number => {
    if (dur >= window) {
      parts.push(`${Math.floor(dur / window)} ${suffix}`);
      return dur % window;
    }
    if (zero && !omitZero) {
      parts.push(`0 ${suffix}`);
    }
    return dur;
  };

  let remainingMs = ms;
  remainingMs = append(remainingMs, MS_PER_MONTH, `month${remainingMs >= MS_PER_MONTH ? "s" : ""}`);
  remainingMs = append(remainingMs, MS_PER_DAY, `day${remainingMs >= MS_PER_DAY ? "s" : ""}`);
  remainingMs = append(remainingMs, MS_PER_HOUR, `hour${remainingMs >= MS_PER_HOUR ? "s" : ""}`);
  remainingMs = append(remainingMs, MS_PER_MIN, `minute${remainingMs >= MS_PER_MIN ? "s" : ""}`);

  if (parts.length < 4) {
    // exclude seconds if we already have 4 parts
    append(remainingMs, MS_PER_SEC, `second${remainingMs >= MS_PER_SEC ? "s" : ""}`);
  }

  return parts;
}

type FormatDurationOpts = {
  omitZero?: boolean;
  segments?: number;
  long?: boolean; // use long format (e.g. "n months n days") instead of short (e.g. "00:00:00:00")
};

export function formatDuration(ms: number, opts?: FormatDurationOpts): string {
  const { omitZero, segments, long } = opts || {};
  const parts = long ? durationPartsLong(ms, omitZero) : durationParts(ms, omitZero);
  return parts.slice(0, segments).join(long ? " " : " : ");
}

export function formatDurationShort(ms: number): string {
  const parts = durationParts(ms);
  const idx = Math.min(
    parts.findIndex((part) => !part.startsWith("00")),
    parts.length - 2,
  );
  return parts.slice(idx, idx + 2).join(" : ");
}

export function secondsToHuman(seconds: number): string | undefined {
  const ms = seconds * 1000;
  const months = Math.floor(ms / MS_PER_MONTH);
  const days = Math.floor((ms % MS_PER_MONTH) / MS_PER_DAY);

  if (months + days === 0) return undefined;
  let text = "";
  if (months > 0) {
    text += `${months} month${months > 1 ? "s " : ""}`;
  }
  if (days > 0) {
    text += `${days} day${days > 1 ? "s " : ""}`;
  }
  return text;
}

export function transformNumberInput(input: string): string {
  let value = input;
  if (value.startsWith(".")) {
    value = `0${value}`;
  }
  if (value.endsWith(".")) {
    value = `${value}0`;
  }
  return value;
}

export function stripTrailingZeros(value: string): string {
  return value.replace(/(\.[0-9]*[1-9])0+$/, "$1").replace(/\.$/, "");
}

export function formatNumberFancy(value: number): string {
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

export function formatLargishValue(num: number): string {
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

export function formatTokenValueLong(
  amount: bigint,
  token: TokenMetadata,
  fiatFn?: (usdValue: number) => string,
): string {
  const value = Number(amount) / 10 ** token.decimals;
  return `${formatNumberFancy(value)} ${token.symbol}${fiatFn ? ` (~${fiatFn((value * token.usdPriceCents) / 100)})` : ""}`;
}

export function tokenScaled(amount: bigint, token: TokenMetadata): number {
  return Number(amount) / 10 ** token.decimals;
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

export function formatTokenParts(
  amount: bigint,
  decimals: number,
  symbol: string,
  options?: TokenFormatOpts,
): string {
  return `${formatTokenValue(amount, decimals, options)} ${symbol}`;
}

function bpsPrecision(bps: number, toFixed?: number): number {
  if (toFixed !== undefined) return toFixed;
  if (bps === 0 || (bps / 100) % 1 === 0) return 0;
  if (bps < 10) return 2;
  return 1;
}

export function formatBps(bps: number, toFixed?: number): string {
  return `${(bps / 100).toFixed(bpsPrecision(bps, toFixed))}%`;
}

export function capitalize(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function formatDatetimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export function noOxfordComma(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
