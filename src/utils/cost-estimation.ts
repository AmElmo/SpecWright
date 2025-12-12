/**
 * Cost Estimation Utility
 * 
 * Provides token cost estimation for AI-assisted specification workflows.
 * Uses model tier brackets instead of specific model pricing.
 */

// ============================================================================
// Model Tier Definitions
// ============================================================================

/**
 * Model tiers representing different price brackets
 * Prices are per 1 million tokens based on late 2024 API pricing
 */
export type ModelTier = 'budget' | 'standard' | 'premium';

export interface TierPricing {
  name: string;
  description: string;
  inputPer1M: number;   // $ per 1M input tokens
  outputPer1M: number;  // $ per 1M output tokens
  examples: string[];   // Example models in this tier
}

/**
 * Pricing tiers based on common model categories (late 2024)
 * 
 * Budget: GPT-4o-mini, Claude Haiku, Gemini Flash
 * Standard: GPT-4o, Claude Sonnet, Gemini Pro  
 * Premium: Claude Opus, GPT-4 Turbo (reasoning), o1-preview
 */
export const MODEL_TIERS: Record<ModelTier, TierPricing> = {
  budget: {
    name: 'Budget Models',
    description: 'Fast, cost-effective models for simpler tasks',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
    examples: ['GPT-4o-mini', 'Claude Haiku', 'Gemini Flash']
  },
  standard: {
    name: 'Standard Models',
    description: 'Balanced performance and cost (most AI tools default)',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    examples: ['GPT-4o', 'Claude Sonnet', 'Gemini Pro']
  },
  premium: {
    name: 'Premium Models',
    description: 'State-of-the-art reasoning and capability',
    inputPer1M: 15.00,
    outputPer1M: 75.00,
    examples: ['Claude Opus', 'GPT-4 Turbo', 'o1-preview']
  }
};

// Default tier for estimation
export const DEFAULT_TIER: ModelTier = 'standard';

// ============================================================================
// Cost Calculation Functions
// ============================================================================

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tier: ModelTier;
  tierName: string;
}

/**
 * Calculate cost for given token counts
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  tier: ModelTier = DEFAULT_TIER
): CostEstimate {
  const pricing = MODEL_TIERS[tier];
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  
  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    tier,
    tierName: pricing.name
  };
}

/**
 * Calculate input cost only (for before AI work)
 */
export function calculateInputCost(
  inputTokens: number,
  tier: ModelTier = DEFAULT_TIER
): Pick<CostEstimate, 'inputTokens' | 'inputCost' | 'tier' | 'tierName'> {
  const pricing = MODEL_TIERS[tier];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  
  return {
    inputTokens,
    inputCost,
    tier,
    tierName: pricing.name
  };
}

/**
 * Calculate output cost only (for after AI work completes)
 */
export function calculateOutputCost(
  outputTokens: number,
  tier: ModelTier = DEFAULT_TIER
): Pick<CostEstimate, 'outputTokens' | 'outputCost' | 'tier' | 'tierName'> {
  const pricing = MODEL_TIERS[tier];
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  
  return {
    outputTokens,
    outputCost,
    tier,
    tierName: pricing.name
  };
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format cost as a currency string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count with thousands separator
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Create a human-readable cost summary
 */
export function formatCostSummary(estimate: CostEstimate): string {
  return `${formatTokens(estimate.inputTokens)} input + ${formatTokens(estimate.outputTokens)} output = ${formatCost(estimate.totalCost)}`;
}

/**
 * Create an input-only cost summary (for prompts before AI work)
 */
export function formatInputCostSummary(inputTokens: number, tier: ModelTier = DEFAULT_TIER): string {
  const { inputCost, tierName } = calculateInputCost(inputTokens, tier);
  return `${formatTokens(inputTokens)} tokens → ${formatCost(inputCost)} (${tierName.replace(' Models', '')} tier)`;
}

// ============================================================================
// Estimation Helpers
// ============================================================================

/**
 * Estimate output tokens based on typical ratios
 * This is a rough estimate since we don't know actual output until completion
 * 
 * Typical ratios observed:
 * - Question generation: ~0.3x input (shorter responses)
 * - Document generation: ~0.8-1.2x input (substantial documents)
 * - Issue breakdown: ~1.5x input (lots of detail per issue)
 */
export type PhaseType = 'questions' | 'document' | 'breakdown';

const OUTPUT_RATIOS: Record<PhaseType, number> = {
  questions: 0.3,
  document: 1.0,
  breakdown: 1.5
};

/**
 * Estimate output tokens for a phase based on input
 */
export function estimateOutputTokens(inputTokens: number, phaseType: PhaseType): number {
  return Math.round(inputTokens * OUTPUT_RATIOS[phaseType]);
}

/**
 * Get phase type from phase name
 */
export function getPhaseType(phase: string): PhaseType {
  if (phase.includes('questions')) return 'questions';
  if (phase.includes('breakdown') || phase.includes('tech-lead')) return 'breakdown';
  return 'document';
}

