import type { LoggingOptions, LogLevel } from "../types.js";

const LEVEL_ORDER: Record<LogLevel, number> = {
  info: 1,
  debug: 2,
  trace: 3,
};

type LogFn = (level: LogLevel, ...args: unknown[]) => void;

let activeLogger: LogFn | null = null;

function defaultLogger(level: LogLevel, ...args: unknown[]) {
  if (args.length === 0) {
    console.log(`[spandex][${level}] -`);
    return;
  }
  console.log(`[spandex][${level}] -`, ...args);
}

export function setLogger(config?: LoggingOptions): void {
  if (!config) {
    activeLogger = null;
    return;
  }
  const sink = config.fn ?? defaultLogger;
  const level = config.level;
  activeLogger = (msgLevel, ...args) => {
    if (LEVEL_ORDER[msgLevel] <= LEVEL_ORDER[level]) {
      sink(msgLevel, ...args);
    }
  };
}

export function log(level: LogLevel, ...args: unknown[]): void {
  activeLogger?.(level, ...args);
}
