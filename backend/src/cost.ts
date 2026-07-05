import type { LlmUsage } from "./providers/types.js";

export interface ProviderPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  thinkingUsdPerMillionTokens: number;
}

export type ProviderPricingCatalog = Record<"fake" | "openai" | "gemini", ProviderPricing>;

export function estimateCostUsdMicros(usage: LlmUsage, pricing: ProviderPricing): number {
  const inputCost =
    (usage.inputTokens * pricing.inputUsdPerMillionTokens * 1_000_000) / 1_000_000;
  const outputCost =
    (usage.outputTokens * pricing.outputUsdPerMillionTokens * 1_000_000) / 1_000_000;
  const thinkingCost =
    ((usage.thinkingTokens ?? 0) * pricing.thinkingUsdPerMillionTokens * 1_000_000) / 1_000_000;

  return Math.round(inputCost + outputCost + thinkingCost);
}

export function usdMicrosToUsd(value: number): number {
  return value / 1_000_000;
}
