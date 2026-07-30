import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { ModelTier } from './types';
import { TIER_CAPS } from './types';

export function resolveTierModel(adapter: ProviderAdapter, tier: ModelTier): { providerId: string; modelId: string } {
  return {
    providerId: adapter.providerId,
    modelId: adapter.getDefaultModelForTier(tier),
  };
}

export function TierCapForTier(tier: ModelTier): { planner: number; tool: number } {
  return TIER_CAPS[tier];
}
