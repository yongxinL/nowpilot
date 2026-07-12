import type { ProviderRegistry } from '../providers/ProviderRegistry';
import type { CostTierType } from '../providers/providerTypes';

export class TierResolver {
  constructor(private registry: ProviderRegistry) {}

  resolve(
    tier: CostTierType,
    preferredProviders: string[],
  ): Array<{ providerId: string; modelId: string }> {
    const models = this.registry.getModelsForTier(tier);

    // Sort by preferredProviders order, preserving original order for non-preferred
    const sorted = [...models].sort((a, b) => {
      const aIdx = preferredProviders.indexOf(a.providerId);
      const bIdx = preferredProviders.indexOf(b.providerId);
      // Both preferred — sort by preference order
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      // One preferred — it comes first
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      // Neither preferred — preserve original order
      return 0;
    });

    return sorted.map(m => ({ providerId: m.providerId, modelId: m.modelId }));
  }
}
