import { debugLog } from '../../utils/debugLog';
import type { ProviderConfig, ModelEntry, CostTierType } from './providerTypes';
import { createOpenAIAdapter } from './adapters/openaiAdapter';
import { createAnthropicAdapter } from './adapters/anthropicAdapter';
import { createGoogleAdapter } from './adapters/googleAdapter';
import { createOpenAICompatAdapter } from './adapters/openaiCompatAdapter';
import { useProviderStore } from '../../stores/providerStore';

const STORAGE_KEY = 'np_provider_registry';

export class ProviderRegistry {
  /** In-memory store of provider configurations */
  #providers = new Map<string, ProviderConfig>();

  /** Lazy-created AI SDK provider instances */
  #instances = new Map<string, unknown>();

  /**
   * Load persisted provider configs from chrome.storage.local.
   * API keys are NOT persisted in the registry — they are read from
   * providerStore at adapter-creation time.
   */
  async initialize(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const persisted = result[STORAGE_KEY];
      if (!persisted) {
        debugLog('info', '[ProviderRegistry] no persisted data found, starting empty');
        return;
      }

      const configs = JSON.parse(persisted) as Array<Omit<ProviderConfig, 'apiKey'>>;
      for (const cfg of configs) {
        const config: ProviderConfig = {
          ...cfg,
          apiKey: undefined,
        };
        this.#providers.set(config.id, config);
      }

      debugLog('info', '[ProviderRegistry] initialized', { providerCount: this.#providers.size });
    } catch (err) {
      debugLog('error', '[ProviderRegistry] initialize failed', { error: err });
    }
  }

  /**
   * Serialize provider configs (without API keys) to chrome.storage.local.
   */
  async persist(): Promise<void> {
    try {
      const providersWithoutKeys: Array<Omit<ProviderConfig, 'apiKey'>> = [];
      for (const provider of this.#providers.values()) {
        const { apiKey: _key, ...rest } = provider;
        providersWithoutKeys.push(rest);
      }
      await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(providersWithoutKeys) });
      debugLog('info', '[ProviderRegistry] persisted', { providerCount: providersWithoutKeys.length });
    } catch (err) {
      debugLog('error', '[ProviderRegistry] persist failed', { error: err });
    }
  }

  /**
   * Register a provider configuration. Stores in in-memory Map and persists.
   * The AI SDK provider instance is NOT created eagerly — it is lazy-created
   * on the first getProvider() call.
   */
  async registerProvider(config: ProviderConfig): Promise<void> {
    if (this.#providers.has(config.id)) {
      throw new Error(`Provider "${config.id}" is already registered`);
    }

    this.#providers.set(config.id, config);
    await this.persist();
    debugLog('info', '[ProviderRegistry] registered', { providerId: config.id });
  }

  /**
   * Get a provider's AI SDK instance and its configuration.
   * The AI SDK instance is lazy-created on first access and cached.
   * API keys are read from useProviderStore at creation time.
   */
  getProvider(
    providerId: string,
  ): { instance: unknown; config: ProviderConfig } | undefined {
    const config = this.#providers.get(providerId);
    if (!config) return undefined;

    // Return cached instance if already created
    const cached = this.#instances.get(providerId);
    if (cached) {
      return { instance: cached, config };
    }

    // Lazy-create AI SDK provider instance
    const apiKey = useProviderStore.getState().apiKeys[providerId] ?? config.apiKey ?? '';
    let instance: unknown;

    try {
      switch (config.type) {
        case 'openai':
          instance = createOpenAIAdapter(apiKey);
          break;
        case 'anthropic':
          instance = createAnthropicAdapter(apiKey);
          break;
        case 'google':
          instance = createGoogleAdapter(apiKey);
          break;
        case 'ollama':
          instance = createOpenAICompatAdapter(apiKey, 'http://localhost:11434/v1');
          break;
        case 'openai-compatible':
          instance = createOpenAICompatAdapter(apiKey, config.baseURL ?? '');
          break;
        default:
          debugLog('error', '[ProviderRegistry] unknown provider type', {
            providerId,
            type: (config as ProviderConfig & { type: string }).type,
          });
          return undefined;
      }
      this.#instances.set(providerId, instance);
      return { instance, config };
    } catch (err) {
      debugLog('error', '[ProviderRegistry] failed to create provider instance', {
        providerId,
        error: err,
      });
      return undefined;
    }
  }

  /**
   * Return all models across all enabled providers that match the given cost tier,
   * sorted by provider priority (lower = higher priority).
   */
  getModelsForTier(tier: CostTierType): ModelEntry[] {
    const result: ModelEntry[] = [];

    for (const provider of this.#providers.values()) {
      if (!provider.enabled) continue;
      for (const model of provider.models) {
        if (model.costTier === tier) {
          result.push(model);
        }
      }
    }

    // Sort by provider priority (ascending — lower number = higher priority)
    result.sort((a, b) => {
      const pa = this.#providers.get(a.providerId);
      const pb = this.#providers.get(b.providerId);
      return (pa?.priority ?? 0) - (pb?.priority ?? 0);
    });

    return result;
  }

  /**
   * Return all models across all enabled providers, sorted by provider priority.
   */
  listModels(): ModelEntry[] {
    const result: ModelEntry[] = [];

    for (const provider of this.#providers.values()) {
      if (!provider.enabled) continue;
      result.push(...provider.models);
    }

    // Sort by provider priority
    result.sort((a, b) => {
      const pa = this.#providers.get(a.providerId);
      const pb = this.#providers.get(b.providerId);
      return (pa?.priority ?? 0) - (pb?.priority ?? 0);
    });

    return result;
  }

  /**
   * Return all registered provider configs.
   */
  listProviders(): ProviderConfig[] {
    return Array.from(this.#providers.values());
  }

  /**
   * Update a specific model entry's metadata and persist.
   */
  async updateModel(
    providerId: string,
    modelId: string,
    updates: Partial<ModelEntry>,
  ): Promise<void> {
    const config = this.#providers.get(providerId);
    if (!config) {
      debugLog('warn', '[ProviderRegistry] updateModel: provider not found', { providerId });
      return;
    }

    const model = config.models.find((m) => m.modelId === modelId);
    if (!model) {
      debugLog('warn', '[ProviderRegistry] updateModel: model not found', { providerId, modelId });
      return;
    }

    Object.assign(model, updates);
    await this.persist();

    debugLog('info', '[ProviderRegistry] model updated', { providerId, modelId, updates });
  }

  /**
   * Remove a provider and its cached instance, then persist.
   */
  async removeProvider(providerId: string): Promise<void> {
    this.#providers.delete(providerId);
    this.#instances.delete(providerId);
    await this.persist();
    debugLog('info', '[ProviderRegistry] removed provider', { providerId });
  }
}

export const providerRegistry = new ProviderRegistry();
