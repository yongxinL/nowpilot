import { describe, it, expect } from 'vitest';
import { TierResolver } from '../../../../src/core/ai/router/TierResolver';
import type { ProviderRegistry } from '../../../../src/core/ai/providers/ProviderRegistry';
import type { ModelEntry, CostTierType } from '../../../../src/core/ai/providers/providerTypes';

function createMockModel(overrides: Partial<ModelEntry> & { providerId: string; modelId: string; costTier: CostTierType }): ModelEntry {
  return {
    contextWindow: 4096,
    modalities: { text: true, image: false, toolUse: false, structuredOutput: false },
    ...overrides,
  };
}

function createMockRegistry(models: ModelEntry[]): Pick<ProviderRegistry, 'getModelsForTier'> {
  return {
    getModelsForTier(tier: CostTierType) {
      return models.filter(m => m.costTier === tier);
    },
  };
}

describe('TierResolver', () => {
  it('resolve returns models sorted by preferredProviders order', () => {
    const models: ModelEntry[] = [
      createMockModel({ providerId: 'anthropic', modelId: 'claude-3-haiku', costTier: 'haiku' }),
      createMockModel({ providerId: 'openai', modelId: 'gpt-4o-mini', costTier: 'haiku' }),
      createMockModel({ providerId: 'google', modelId: 'gemini-2.0-flash', costTier: 'haiku' }),
    ];
    const registry = createMockRegistry(models);
    const resolver = new TierResolver(registry as unknown as ProviderRegistry);

    // preferred: openai first, then anthropic
    const result = resolver.resolve('haiku', ['openai', 'anthropic']);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ providerId: 'openai', modelId: 'gpt-4o-mini' });
    expect(result[1]).toEqual({ providerId: 'anthropic', modelId: 'claude-3-haiku' });
    expect(result[2]).toEqual({ providerId: 'google', modelId: 'gemini-2.0-flash' });
  });

  it('resolve returns empty array when no model matches tier', () => {
    const registry = createMockRegistry([]);
    const resolver = new TierResolver(registry as unknown as ProviderRegistry);
    const result = resolver.resolve('opus', ['openai']);
    expect(result).toEqual([]);
  });

  it('resolve returns models in priority order when only some providers preferred', () => {
    const models: ModelEntry[] = [
      createMockModel({ providerId: 'anthropic', modelId: 'claude-3-sonnet', costTier: 'sonnet' }),
      createMockModel({ providerId: 'openai', modelId: 'gpt-4o', costTier: 'sonnet' }),
      createMockModel({ providerId: 'google', modelId: 'gemini-2.0-pro', costTier: 'sonnet' }),
    ];
    const registry = createMockRegistry(models);
    const resolver = new TierResolver(registry as unknown as ProviderRegistry);

    // Only prefer openai, others follow in original order
    const result = resolver.resolve('sonnet', ['openai']);
    expect(result).toHaveLength(3);
    expect(result[0].providerId).toBe('openai');
    // Non-preferred ones maintain their relative order
    expect(result[1].providerId).toBe('anthropic');
    expect(result[2].providerId).toBe('google');
  });

  it('resolve with empty preferredProviders returns models as-is from registry', () => {
    const models: ModelEntry[] = [
      createMockModel({ providerId: 'openai', modelId: 'gpt-4o-mini', costTier: 'haiku' }),
      createMockModel({ providerId: 'anthropic', modelId: 'claude-3-haiku', costTier: 'haiku' }),
    ];
    const registry = createMockRegistry(models);
    const resolver = new TierResolver(registry as unknown as ProviderRegistry);

    const result = resolver.resolve('haiku', []);
    expect(result).toHaveLength(2);
  });
});
