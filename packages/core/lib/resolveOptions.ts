import type {
  AggregationOptions,
  FeeSettings,
  ResolvedFeeOptions,
  StaticFeeOptions,
  SwapOptions,
  SwapParams,
  TimingOptions,
} from "./types.js";

/**
 * Resolves static or dynamic aggregation options into the static shape providers consume.
 */
export async function resolveSwapOptions(
  swap: SwapParams,
  options?: AggregationOptions | SwapOptions,
): Promise<SwapOptions> {
  if (!options) {
    return {};
  }

  const timing = timingOptions(options);
  if (!options.integratorFeeFn) {
    const resolved = { ...timing, ...staticFeeOptions(options) };
    validateFeeOptions(resolved);
    return resolved;
  }

  const feeSettings = normalizeFeeSettings(await options.integratorFeeFn(swap));
  const resolved = { ...timing, ...feeSettings };
  validateFeeOptions(resolved);
  return resolved;
}

export function validateStaticFeeOptions(options: AggregationOptions): void {
  if (options.integratorFeeFn) {
    const staticKeys: Array<keyof StaticFeeOptions> = [
      "integratorFeeAddress",
      "integratorSwapFeeBps",
      "integratorSurplusBps",
      "integratorSurplusAddress",
    ];
    const configuredStaticKeys = staticKeys.filter((key) => options[key] !== undefined);
    if (configuredStaticKeys.length > 0) {
      throw new Error("`integratorFeeFn` cannot be combined with static integrator fee options.");
    }
    return;
  }

  validateFeeOptions(options);
}

function timingOptions(options: TimingOptions): TimingOptions {
  return {
    deadlineMs: options.deadlineMs,
    numRetries: options.numRetries,
    initialRetryDelayMs: options.initialRetryDelayMs,
  };
}

function staticFeeOptions(options: ResolvedFeeOptions): ResolvedFeeOptions {
  return {
    integratorFeeAddress: options.integratorFeeAddress,
    integratorSwapFeeBps: options.integratorSwapFeeBps,
    integratorSurplusBps: options.integratorSurplusBps,
    integratorSurplusAddress: options.integratorSurplusAddress,
    integratorFeeTokenPreference: options.integratorFeeTokenPreference,
  };
}

function normalizeFeeSettings(settings: FeeSettings | null | undefined): ResolvedFeeOptions {
  if (!settings) {
    return {};
  }

  return {
    integratorFeeAddress: settings.feeAddress,
    integratorSwapFeeBps: settings.swapFeeBps,
    integratorSurplusBps: settings.surplusFeeBps,
    integratorSurplusAddress: settings.surplusAddress,
    integratorFeeTokenPreference: settings.tokenPreference,
  };
}

function validateFeeOptions(options: StaticFeeOptions): void {
  if (
    ((options.integratorSwapFeeBps || 0) > 0 || (options.integratorSurplusBps || 0) > 0) &&
    !options.integratorFeeAddress
  ) {
    throw new Error(
      "Swap fees or surplus bps provided without an integrator fee address. Set `integratorFeeAddress` in AggregationOptions.",
    );
  }
  if (
    options.integratorFeeAddress &&
    !options.integratorSwapFeeBps &&
    !options.integratorSurplusBps
  ) {
    throw new Error(
      "Integrator fee address provided without swap fees or surplus bps. Set `integratorSwapFeeBps` or `integratorSurplusBps` in AggregationOptions.",
    );
  }
}
