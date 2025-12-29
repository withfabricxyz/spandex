import { average } from "./pricing.js";
import type { PricingSummary, Quote, TokenPricing } from "./types.js";

/**
 * Aggregates pricing metadata across quotes, averaging USD prices when multiple sources are present.
 *
 * @param quotes - Quote array to summarize.
 * @returns Aggregated pricing summary.
 */
export function getPricing(quotes: Quote[]): PricingSummary {
  const sources = new Set<Quote["provider"]>();
  const inputPrices: number[] = [];
  const outputPrices: number[] = [];
  let inputToken: TokenPricing | undefined;
  let outputToken: TokenPricing | undefined;

  for (const quote of quotes) {
    if (!quote.success || !quote.pricing) {
      continue;
    }

    sources.add(quote.provider);

    inputToken = mergeTokenMeta(inputToken, quote.pricing.inputToken);
    outputToken = mergeTokenMeta(outputToken, quote.pricing.outputToken);

    const inputPrice = resolveUsdPrice(quote.pricing.inputToken);
    if (inputPrice !== undefined) {
      inputPrices.push(inputPrice);
    }

    const outputPrice = resolveUsdPrice(quote.pricing.outputToken);
    if (outputPrice !== undefined) {
      outputPrices.push(outputPrice);
    }
  }

  return {
    sources: [...sources],
    inputToken: buildSummaryToken(inputToken, inputPrices),
    outputToken: buildSummaryToken(outputToken, outputPrices),
  };
}

function resolveUsdPrice(token: TokenPricing | undefined): number | undefined {
  return token?.usdPrice;
}

function mergeTokenMeta(
  base: TokenPricing | undefined,
  next: TokenPricing | undefined,
): TokenPricing | undefined {
  if (!next) {
    return base;
  }
  if (!base) {
    return {
      address: next.address,
      symbol: next.symbol,
      decimals: next.decimals,
      logoURI: next.logoURI,
    };
  }
  if (base.address.toLowerCase() !== next.address.toLowerCase()) {
    return base;
  }
  return {
    address: base.address,
    symbol: base.symbol ?? next.symbol,
    decimals: base.decimals ?? next.decimals,
    logoURI: base.logoURI ?? next.logoURI,
  };
}

function buildSummaryToken(
  token: TokenPricing | undefined,
  prices: number[],
): TokenPricing | undefined {
  if (!token) {
    return undefined;
  }

  const usdPrice = average(prices);

  return {
    ...token,
    usdPrice,
  };
}
