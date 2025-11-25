import type { AggregationOptions } from "./types.js";

const MIN_RETRIES = 0;
const MAX_RETRIES = 10;
const DEFAULT_RETRIES = 1;
const MIN_INITIAL_DELAY_MS = 5;
const MAX_INITIAL_DELAY_MS = 10_000;
const DEFAULT_INITIAL_DELAY_MS = 100;
const MIN_DEADLINE_MS = 10;
const MAX_DEADLINE_MS = 120_000;
const DEFAULT_DEADLINE_MS = 8_000;

export function resolveTimingControls(options?: AggregationOptions) {
  const deadlineMs = options?.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const numRetries = options?.numRetries ?? DEFAULT_RETRIES;
  const delayMs = options?.initialRetryDelayMs ?? DEFAULT_INITIAL_DELAY_MS;

  return {
    deadlineMs: Math.min(Math.max(deadlineMs, MIN_DEADLINE_MS), MAX_DEADLINE_MS),
    numRetries: Math.min(Math.max(numRetries, MIN_RETRIES), MAX_RETRIES),
    delayMs: Math.min(Math.max(delayMs, MIN_INITIAL_DELAY_MS), MAX_INITIAL_DELAY_MS),
  };
}
