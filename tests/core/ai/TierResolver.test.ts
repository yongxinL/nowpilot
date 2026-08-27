import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  resolveTier,
  TIER_TO_MODEL_CANDIDATES,
  type TierResolution,
} from '../../../src/core/ai/TierResolver';
import { ProviderRegistry, __test__ as registryTest } from '../../../src/core/ai/ProviderRegistry';
import { useUserPreferencesStore } from '../../../src/core/ai/UserPreferences';
import { __test__ as adapterTest } from '../../../src/core/theme/chromeStorageAdapter';

/**
 * TierResolver tests (plan 03-05, Task 2 — additive test file proving the
 * Task 2 acceptance criteria repeatably): D-53 capability-tiers-only table,
 * the D-54a null contract, and D-52-validated resolution from persisted prefs.
 */
const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

const seedDisk = {
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: true,
      enabled: true,
      models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true }],
    },
    claude: {
      id: 'claude',
      name: 'Claude',
      isConfigured: true,
      enabled: true,
      models: [{ id: 'claude-3-5-haiku-20241022', name: 'haiku', enabled: true }],
    },
    ollama: {
      id: 'ollama',
      name: 'Ollama',
      isConfigured: true,
      enabled: true,
      models: [{ id: 'llama3.2', name: 'llama3.2', enabled: true }],
    },
  },
};

/** openai + anthropic (claude) + ollama enabled, each with a discovered cache. */
async function seedHydrated(): Promise<void> {
  storageMap.clear();
  adapterTest.resetPendingState();
  registryTest.reset();
  storageMap.set('np_providers', JSON.stringify(seedDisk));
  await ProviderRegistry.hydrate();
  registryTest.seedCachedModels('openai', ['gpt-4o-mini']);
  registryTest.seedCachedModels('anthropic', ['claude-3-5-haiku-20241022']);
  registryTest.seedCachedModels('ollama', ['llama3.2']);
}

beforeEach(async () => {
  await seedHydrated();
  // Reset prefs to the unpersisted baseline (D-54a).
  useUserPreferencesStore.setState({
    fastModel: undefined,
    balancedModel: undefined,
    personaOverrides: undefined,
  });
});

describe('TIER_TO_MODEL_CANDIDATES — D-53 capability tiers only', () => {
  it('contains exactly the keys fast and balanced', () => {
    expect(Object.keys(TIER_TO_MODEL_CANDIDATES).sort()).toEqual(['balanced', 'fast']);
  });

  it('contains ZERO vendor model slugs — capability descriptors only (comment-filtered negative gate)', () => {
    const body = readFileSync('src/core/ai/TierResolver.ts', 'utf8');
    const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/gpt-|claude-|gemini-|llama[0-9]|o1-|o3-/);
    for (const tier of ['fast', 'balanced'] as const) {
      for (const c of TIER_TO_MODEL_CANDIDATES[tier]) {
        expect(c).not.toHaveProperty('model');
        expect(c.capability).toMatch(/^(low-cost|higher-capability)$/);
      }
    }
    // D-56: OpenAICompat has NO default entry.
    const all = [...TIER_TO_MODEL_CANDIDATES.fast, ...TIER_TO_MODEL_CANDIDATES.balanced];
    expect(all.some((c) => c.providerId === 'openai-compat')).toBe(false);
  });
});

describe('resolveTier — D-54a null contract', () => {
  it('returns null when the tier preference is not persisted (no inference, no guessing)', () => {
    useUserPreferencesStore.setState({ fastModel: undefined, balancedModel: 'gpt-4o-mini' });
    expect(resolveTier('fast')).toBeNull();
    // The persisted tier DOES resolve.
    expect(resolveTier('balanced')).toEqual<TierResolution>({
      providerId: 'openai',
      model: 'gpt-4o-mini',
    });

    useUserPreferencesStore.setState({ fastModel: 'gpt-4o-mini', balancedModel: undefined });
    expect(resolveTier('balanced')).toBeNull();
    expect(resolveTier('fast')).toEqual<TierResolution>({
      providerId: 'openai',
      model: 'gpt-4o-mini',
    });
  });

  it('returns null for an empty-string preference', () => {
    useUserPreferencesStore.setState({ fastModel: '', balancedModel: 'gpt-4o-mini' });
    expect(resolveTier('fast')).toBeNull();
  });

  it('returns null when the persisted model is not in any candidate discovered set — never invents a model name', () => {
    useUserPreferencesStore.setState({ fastModel: 'gpt-999-fake-model' });
    expect(resolveTier('fast')).toBeNull();
  });

  it('returns null when no candidates are enabled in the registry', async () => {
    storageMap.clear();
    adapterTest.resetPendingState();
    registryTest.reset();
    // Nothing enabled on disk — only registered-but-disabled providers.
    await ProviderRegistry.hydrate();
    registryTest.seedCachedModels('openai', ['gpt-4o-mini']);
    useUserPreferencesStore.setState({ fastModel: 'gpt-4o-mini' });
    expect(resolveTier('fast')).toBeNull();
  });
});

describe('resolveTier — D-52-validated resolution from persisted prefs', () => {
  it('resolves a persisted openai model to (openai, model)', () => {
    useUserPreferencesStore.setState({ fastModel: 'gpt-4o-mini' });
    expect(resolveTier('fast')).toEqual<TierResolution>({
      providerId: 'openai',
      model: 'gpt-4o-mini',
    });
  });

  it('resolves a persisted anthropic model to (anthropic, model) via the disk claude→anthropic mapping', () => {
    useUserPreferencesStore.setState({ fastModel: 'claude-3-5-haiku-20241022' });
    expect(resolveTier('fast')).toEqual<TierResolution>({
      providerId: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
    });
  });

  it('resolves balanced via the balanced candidate list', () => {
    useUserPreferencesStore.setState({ balancedModel: 'gpt-4o-mini' });
    expect(resolveTier('balanced')).toEqual<TierResolution>({
      providerId: 'openai',
      model: 'gpt-4o-mini',
    });
  });
});

describe('resolveTier — Appendix D privacyMode handling verbatim', () => {
  it("local-only restricts candidates to ollama — a cloud model resolves to null", () => {
    useUserPreferencesStore.setState({ fastModel: 'llama3.2' });
    expect(resolveTier('fast', { privacyMode: 'local-only' })).toEqual<TierResolution>({
      providerId: 'ollama',
      model: 'llama3.2',
    });

    useUserPreferencesStore.setState({ fastModel: 'gpt-4o-mini' });
    expect(resolveTier('fast', { privacyMode: 'local-only' })).toBeNull();
  });

  it('prefer-local keeps cloud candidates but reorders ollama first', () => {
    useUserPreferencesStore.setState({ fastModel: 'llama3.2' });
    expect(resolveTier('fast', { privacyMode: 'prefer-local' })).toEqual<TierResolution>({
      providerId: 'ollama',
      model: 'llama3.2',
    });

    // Cloud model still resolves under prefer-local (ollama is preferred, not exclusive).
    useUserPreferencesStore.setState({ fastModel: 'gpt-4o-mini' });
    expect(resolveTier('fast', { privacyMode: 'prefer-local' })).toEqual<TierResolution>({
      providerId: 'openai',
      model: 'gpt-4o-mini',
    });
  });
});