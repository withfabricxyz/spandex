import { BaseInsightTooltip } from "./shared";

export function GasTooltip() {
  return (
    <BaseInsightTooltip
      label="Gas"
      description="The network fee required to process this transaction onchain."
    />
  );
}

export function MaxSlippageTooltip() {
  return (
    <BaseInsightTooltip
      label="Max Slippage"
      description="How much the price is allowed to change before your trade reverts."
    />
  );
}

export function PriceImpactTooltip() {
  return (
    <BaseInsightTooltip
      label="Price Impact"
      description="How much your trade moves the market price."
    />
  );
}
