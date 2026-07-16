import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../../../src/core/ai/providers/ProviderRegistry';
import type { ProviderConfig } from '../../../../src/core/ai/providers/providerTypes';

const openAIConfig: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  type: 'openai',
  apiKey: 'sk-test-openai',
  models: [
    {
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      costTier: 'haiku',
      contextWindow: 128000,
      modalities: { text: true, image: true, toolUse: true, structuredOutput: true },
    },
    {
      providerId: 'openai',
      modelId: 'gpt-4o',
      costTier: 'sonnet',
      contextWindow: 128000,
      modalities: { text: true, image: true, toolUse: true, structuredOutput: true },
    },
  ],
  priority: 1,
  enabled: true,
};

const anthropicConfig: ProviderConfig = {
  id: 'anthropic',
  name: 'Anthropic',
  type: 'anthropic',
  apiKey: 'sk-test-anthropic',
  models: [
    {
      providerId: 'anthropic',
      modelId: 'claude-3-5-haiku-latest',
      costTier: 'haiku',
      contextWindow: 200000,
      modalities: { text: true, image: true, toolUse: true, structuredOutput: true },
    },
  ],
  priority: 2,
  enabled: true,
};

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let localGetMock: ReturnType<typeof vi.fn>;
  let localSetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    localGetMock = vi.mocked(chrome.storage.local.get) as unknown as ReturnType<typeof vi.fn>;
    localSetMock = vi.mocked(chrome.storage.local.set) as unknown as ReturnType<typeof vi.fn>;

    localGetMock.mockResolvedValue({});

    registry = new ProviderRegistry();
  });

  it('registerProvider stores a provider with its models in the in-memory Map', async () => {
    await registry.registerProvider(openAIConfig);

    const providers = registry.listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe('openai');
    expect(providers[0].models).toHaveLength(2);
  });

  it('registerProvider persists to chrome.storage.local under np_provider_registry key', async () => {
    await registry.registerProvider(openAIConfig);

    expect(localSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        np_provider_registry: expect.anything(),
      }),
    );
  });

  it('getModelsForTier returns only models whose costTier matches', async () => {
    await registry.registerProvider(openAIConfig);
    await registry.registerProvider(anthropicConfig);

    const haikuModels = registry.getModelsForTier('haiku');
    expect(haikuModels).toHaveLength(2);
    expect(haikuModels.every((m) => m.costTier === 'haiku')).toBe(true);

    const sonnetModels = registry.getModelsForTier('sonnet');
    expect(sonnetModels).toHaveLength(1);
    expect(sonnetModels[0].costTier).toBe('sonnet');
  });

  it('getModelsForTier returns models sorted by provider priority', async () => {
    await registry.registerProvider(anthropicConfig);
    await registry.registerProvider(openAIConfig);

    const haikuModels = registry.getModelsForTier('haiku');
    expect(haikuModels[0].providerId).toBe('openai');
    expect(haikuModels[1].providerId).toBe('anthropic');
  });

  it('getProvider returns the provider config and lazy-created instance', async () => {
    await registry.registerProvider(openAIConfig);

    const result = registry.getProvider('openai');
    expect(result).toBeDefined();
    expect(result!.config.id).toBe('openai');
    expect(result!.instance).toBeDefined();
  });

  it('getProvider returns undefined for unknown provider', () => {
    const result = registry.getProvider('nonexistent');
    expect(result).toBeUndefined();
  });

  it('listModels returns all ModelEntry across all providers sorted by priority', async () => {
    await registry.registerProvider(anthropicConfig);
    await registry.registerProvider(openAIConfig);

    const allModels = registry.listModels();
    expect(allModels).toHaveLength(3);
    expect(allModels[0].providerId).toBe('openai');
    expect(allModels[1].providerId).toBe('openai');
    expect(allModels[2].providerId).toBe('anthropic');
  });

  it('initialize loads persisted data from chrome.storage.local', async () => {
    await registry.registerProvider(openAIConfig);

    const setCall = localSetMock.mock.calls.find(
      (call: unknown[]) =>
        call[0] && typeof call[0] === 'object' && 'np_provider_registry' in (call[0] as Record<string, unknown>),
    );
    expect(setCall).toBeDefined();
    const persistedData = (setCall![0] as Record<string, unknown>).np_provider_registry;

    const freshRegistry = new ProviderRegistry();
    localGetMock.mockResolvedValue({ np_provider_registry: persistedData });

    await freshRegistry.initialize();

    const providers = freshRegistry.listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe('openai');
  });

  it('updateModel updates a specific model entry and persists', async () => {
    await registry.registerProvider(openAIConfig);

    await registry.updateModel('openai', 'gpt-4o-mini', { contextWindow: 64000 });

    const models = registry.listModels();
    const updated = models.find((m) => m.modelId === 'gpt-4o-mini');
    expect(updated).toBeDefined();
    expect(updated!.contextWindow).toBe(64000);

    expect(localSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        np_provider_registry: expect.anything(),
      }),
    );
  });

  it('removeProvider removes the provider from Map and persists', async () => {
    await registry.registerProvider(openAIConfig);
    await registry.registerProvider(anthropicConfig);
    expect(registry.listProviders()).toHaveLength(2);

    await registry.removeProvider('openai');
    expect(registry.listProviders()).toHaveLength(1);
    expect(registry.getProvider('openai')).toBeUndefined();

    expect(localSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        np_provider_registry: expect.anything(),
      }),
    );
  });

  it('registerProvider throws on duplicate provider id', async () => {
    await registry.registerProvider(openAIConfig);
    await expect(registry.registerProvider(openAIConfig)).rejects.toThrow('already registered');
  });

  it('getModelsForTier returns empty array when no models match tier', async () => {
    await registry.registerProvider(openAIConfig);
    const opusModels = registry.getModelsForTier('opus');
    expect(opusModels).toHaveLength(0);
  });

  it('listProviders returns all registered providers', async () => {
    await registry.registerProvider(openAIConfig);
    await registry.registerProvider(anthropicConfig);
    const all = registry.listProviders();
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.id)).toEqual(['openai', 'anthropic']);
  });

  it('initialize seeds defaults when no persisted data found', async () => {
    localGetMock.mockResolvedValue({});
    await registry.initialize();

    const providers = registry.listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(4);
    expect(providers[0].id).toBe('openai');
    // Default providers have no hardcoded models — models are populated via discovery
    expect(providers[0].models).toEqual([]);
  });

  it('persist serializes providers without API keys', async () => {
    await registry.registerProvider(openAIConfig);
    await registry.registerProvider(anthropicConfig);

    const setCalls = localSetMock.mock.calls.filter(
      (call: unknown[]) =>
        call[0] && typeof call[0] === 'object' && 'np_provider_registry' in (call[0] as Record<string, unknown>),
    );
    const lastCall = setCalls[setCalls.length - 1];
    const persisted = (lastCall![0] as Record<string, unknown>).np_provider_registry as string;
    const parsed = JSON.parse(persisted);

    for (const provider of parsed) {
      expect(provider).not.toHaveProperty('apiKey');
    }
  });
});
