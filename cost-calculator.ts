import type { AIModelId, AIModelInfo, TokenPricingDetail, AIModelPricing } from './types';
import { SUPPORTED_AI_MODELS } from './types';

// Helper to find the most specific pricing tier
function getApplicablePricing(
  pricing: AIModelPricing,
  tokenCountKey: 'inputTokens' | 'outputTokens', // To determine if we're looking for input or output cost
  contextTokenCount?: number // Total tokens in the prompt, relevant for tiered pricing
): TokenPricingDetail | undefined {
  // Handle Gemini 1.5 style tiered pricing based on context window
  if (pricing.inputStandardContextLt128k && pricing.outputStandardContextLt128k &&
      pricing.inputStandardContextGt128k && pricing.outputStandardContextGt128k &&
      contextTokenCount !== undefined) {
    if (tokenCountKey === 'inputTokens') {
      return contextTokenCount <= 128000 
        ? pricing.inputStandardContextLt128k 
        : pricing.inputStandardContextGt128k;
    } else { // outputTokens
      return contextTokenCount <= 128000
        ? pricing.outputStandardContextLt128k
        : pricing.outputStandardContextGt128k;
    }
  }

  // Handle Gemini 2.5 Flash specific output pricing
  if (pricing.outputNoThinking && pricing.outputWithThinking && tokenCountKey === 'outputTokens') {
    // This is a simplification. We don't know if it was "with thinking" or "no thinking".
    // Defaulting to "with thinking" as it's more expensive / safer estimate.
    // A more advanced implementation might try to infer or allow user to specify.
    return pricing.outputWithThinking;
  }
  
  // General input/output pricing
  if (tokenCountKey === 'inputTokens' && pricing.input) {
    return pricing.input;
  }
  if (tokenCountKey === 'outputTokens' && pricing.output) {
    return pricing.output;
  }

  // Fallback if specific tiered or type pricing isn't matched
  return pricing.input; // Default to input if nothing else matches, or could be undefined
}


export function calculateAICost(
  modelId: AIModelId,
  inputTokens: number,
  outputTokens: number,
): number {
  const modelInfo = SUPPORTED_AI_MODELS.find(m => m.id === modelId);
  if (!modelInfo) {
    console.warn(`Pricing info not found for model ID: ${modelId}. Cost calculation will be 0.`);
    return 0;
  }

  let totalCost = 0;
  const { pricing } = modelInfo;

  // Calculate cost for input tokens
  if (inputTokens > 0) {
    const inputPricingDetail = getApplicablePricing(pricing, 'inputTokens', inputTokens + outputTokens /* pass total for context window check */);
    if (inputPricingDetail) {
      totalCost += (inputTokens / inputPricingDetail.perTokens) * inputPricingDetail.usd;
    } else {
      console.warn(`Input pricing tier not found for model ${modelId}. Input token cost will be 0.`);
    }
  }

  // Calculate cost for output tokens
  if (outputTokens > 0) {
    const outputPricingDetail = getApplicablePricing(pricing, 'outputTokens', inputTokens + outputTokens /* pass total for context window check */);
    if (outputPricingDetail) {
      totalCost += (outputTokens / outputPricingDetail.perTokens) * outputPricingDetail.usd;
    } else {
      console.warn(`Output pricing tier not found for model ${modelId}. Output token cost will be 0.`);
    }
  }
  
  // Round to a reasonable number of decimal places (e.g., 6 for micro-costs)
  return parseFloat(totalCost.toFixed(6));
}