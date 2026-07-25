import { debugLog } from '../../utils/debugLog';
import type { ProviderConfig, ModelEntry, CostTierType } from './providerTypes';
import { createOpenAIAdapter } from './adapters/openaiAdapter';
import { createAnthropicAdapter } from './adapters/anthropicAdapter';
import { createGoogleAdapter } from './adapters/googleAdapter';
import { createOpenAICompatAdapter } from './adapters/openaiCompatAdapter';
import { useProviderStore, storeHydration } from '../../stores/providerStore';
import { modelDiscovery, getDiscoveryEndpoint, discoveredToModelEntries } from './modelDiscovery';

const STORAGE_KEY = 'np_provider_registry';

const DEFAULT_PROVIDERS: Omit<ProviderConfig, 'models'>[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    enabled: true,
    priority: 1,
  },
  {
    id: 'google',
    name: 'Google AI',
    type: 'google',
    enabled: true,
    priority: 0,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    priority: 2,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    type: 'ollama',
    enabled: true,
    priority: 3,
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    type: 'openai-compatible',
    enabled: true,
    priority: 4,
  },
];

function addEmptyModels(p: Omit<ProviderConfig, 'models'>): ProviderConfig {
  return { ...p, models: [] };
}

export class ProviderRegistry {
  #providers = new Map<string, ProviderConfig>();

  #instances = new Map<string, unknown>();
  #cachedKeys = new Map<string, string>();
  #cachedBaseURLs = new Map<string, string>();

  #initPromise: Promise<void> | null = null;

  async initialize(forceReload = false): Promise<void> {
    if (this.#initPromise && !forceReload) return this.#initPromise;

    this.#initPromise = (async () => {
      try {
        await storeHydration;

        const result = await chrome.storage.local.get(STORAGE_KEY);
        const persisted = result[STORAGE_KEY];

        if (!persisted) {
          debugLog('info', '[ProviderRegistry] no persisted data found, seeding defaults');
          const configs = DEFAULT_PROVIDERS.map((p) => addEmptyModels(p));
          const configsWithoutKeys = configs.map(({ apiKey: _k, ...rest }) => rest);
          await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(configsWithoutKeys) });

          for (const config of configs) {
            this.#providers.set(config.id, config);
          }

          debugLog('info', `[ProviderRegistry] seeded ${this.#providers.size} default providers`);
        } else {
          const configs = JSON.parse(persisted as string) as Array<Omit<ProviderConfig, 'apiKey'>>;
          for (const cfg of configs) {
            const config: ProviderConfig = {
              ...cfg,
              models: cfg.models ?? [],
              apiKey: undefined,
            };
            this.#providers.set(config.id, config);
          }
        }

        // Sync with connection configurations from `np_provider_configs`
        const configsResult = await chrome.storage.local.get('np_provider_configs');
        const userConfigs = configsResult.np_provider_configs;
        if (Array.isArray(userConfigs)) {
          for (const uCfg of userConfigs) {
            const pId = uCfg.id?.toLowerCase() || uCfg.name?.toLowerCase();
            let provider = this.#providers.get(pId);
            if (!provider) {
              for (const p of this.#providers.values()) {
                if (p.name?.toLowerCase() === uCfg.name?.toLowerCase() || p.id?.toLowerCase() === uCfg.id?.toLowerCase()) {
                  provider = p;
                  break;
                }
              }
            }
            if (provider) {
              if (uCfg.enabled !== undefined) {
                provider.enabled = uCfg.enabled;
              }
              if (uCfg.baseURL !== undefined) {
                provider.baseURL = uCfg.baseURL;
              }
              if (uCfg.apiKey !== undefined && uCfg.apiKey) {
                provider.apiKey = uCfg.apiKey;
              }
            }
          }
        }

        await this.discoverAllModels();

        // Fallback: for providers with no discovered models, load manually configured models
        // from np_provider_config_{id}.enabledModels (e.g. user specified custom models)
        await this.loadManualModels();

        // Apply the enabledModels filter from per-provider configs so disabled
        // models are excluded from provider.model lists and won't be selectable.
        await this.applyEnabledModelsFilter();

        const allModels = Array.from(this.#providers.values()).flatMap(p => p.models);
        debugLog('info', `[ProviderRegistry] initialized (${this.#providers.size} providers, ${allModels.length} models)`);
      } catch (err) {
        debugLog('error', '[ProviderRegistry] initialize failed', { error: err });
        this.#initPromise = null;
      }
    })();

    return this.#initPromise;
  }

  async discoverAllModels(): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const provider of this.#providers.values()) {
      if (!provider.enabled) continue;
      tasks.push(this.discoverModels(provider.id));
    }
    await Promise.all(tasks);
  }

  private async loadManualModels(): Promise<void> {
    const configsResult = await chrome.storage.local.get('np_provider_configs');
    const configs = configsResult.np_provider_configs as
      Array<{ id?: string; name?: string; enabled?: boolean }> | undefined;
    if (!Array.isArray(configs)) return;

    for (const cfg of configs) {
      if (!cfg.enabled) continue;
      const pId = (cfg.id || cfg.name || '').toLowerCase();
      const ppKey = `np_provider_config_${pId}`;
      let ppResult: Record<string, unknown>;
      try {
        ppResult = await chrome.storage.local.get(ppKey);
      } catch {
        continue;
      }
      const ppConfig = ppResult[ppKey] as { enabledModels?: string[] } | undefined;
      if (!ppConfig?.enabledModels || !Array.isArray(ppConfig.enabledModels)) continue;
      if (ppConfig.enabledModels.length === 0) continue;

      // Find matching registry provider by ID or name
      let provider = this.#providers.get(pId);
      if (!provider) {
        const cfgName = cfg.name?.toLowerCase();
        if (cfgName) {
          for (const p of this.#providers.values()) {
            if (p.name?.toLowerCase() === cfgName || p.id?.toLowerCase() === cfgName) {
              provider = p;
              break;
            }
          }
        }
      }
      if (!provider) continue;
      if (provider.models.length > 0) continue;

      provider.models = ppConfig.enabledModels.map(mId => ({
        providerId: provider.id,
        modelId: mId,
        costTier: 'haiku' as const,
        contextWindow: 4096,
        modalities: { text: true, image: true, toolUse: true, structuredOutput: true },
      }));
      debugLog('info', `[ProviderRegistry] loaded ${provider.models.length} manual models for ${provider.id} (cfg id: ${pId})`);
    }
  }

  /**
   * After discovery and manual loading, filter each provider's model list to only
   * include models that are in the user's enabledModels list (if one exists).
   * This prevents disabled models from being selected via ProviderRouter.
   */
  private async applyEnabledModelsFilter(): Promise<void> {
    for (const provider of this.#providers.values()) {
      if (!provider.enabled) {
        provider.models = [];
        continue;
      }
      const ppKey = `np_provider_config_${provider.id}`;
      let ppResult: Record<string, unknown>;
      try {
        ppResult = await chrome.storage.local.get(ppKey);
      } catch {
        continue;
      }
      const ppConfig = ppResult[ppKey] as { enabledModels?: string[] } | undefined;
      if (!ppConfig?.enabledModels || !Array.isArray(ppConfig.enabledModels)) continue;
      if (ppConfig.enabledModels.length === 0) {
        provider.models = [];
        continue;
      }
      const before = provider.models.length;
      provider.models = provider.models.filter(m => ppConfig.enabledModels!.includes(m.modelId));
      if (provider.models.length !== before) {
        debugLog('info', `[ProviderRegistry] enabledModels filter removed ${before - provider.models.length} models from ${provider.id}`);
      }
    }
  }

  async discoverModels(providerId: string): Promise<ModelEntry[]> {
    const provider = this.#providers.get(providerId);
    if (!provider) {
      debugLog('warn', '[ProviderRegistry] discoverModels: provider not found', { providerId });
      return [];
    }

    const state = useProviderStore.getState();
    const apiKey = state.apiKeys[providerId] ||
                   state.apiKeys[provider.name] ||
                   state.apiKeys[providerId.toLowerCase()] ||
                   provider.apiKey;

    if (!apiKey) {
      debugLog('info', `[ProviderRegistry] discoverModels: no API key for ${providerId} — skipping discovery, preserving ${provider.models.length} existing models`);
      return provider.models;
    }

    const endpoint = getDiscoveryEndpoint(provider);
    if (!endpoint) {
      debugLog('warn', '[ProviderRegistry] discoverModels: no endpoint for provider', { providerId });
      return provider.models;
    }

    try {
      const discovered = await modelDiscovery.discover(endpoint, apiKey, provider.type);

      if (discovered.length === 0) {
        debugLog('info', `[ProviderRegistry] discoverModels: no models discovered for ${providerId}, preserving ${provider.models.length} existing models`);
        return provider.models;
      }

      const entries = discoveredToModelEntries(discovered, providerId);

      // Deduplicate by modelId
      const seen = new Set<string>();
      provider.models = entries.filter((m) => {
        if (seen.has(m.modelId)) return false;
        seen.add(m.modelId);
        return true;
      });

      // Clear cached provider instance so next getProvider() picks up fresh config
      this.#instances.delete(providerId);
      this.#cachedKeys.delete(providerId);
      this.#cachedBaseURLs.delete(providerId);

      debugLog('info', `[ProviderRegistry] discoverModels: ${provider.models.length} models discovered for ${providerId}`);

      return provider.models;
    } catch (err) {
      debugLog('warn', `[ProviderRegistry] discoverModels: discovery failed for ${providerId}, preserving ${provider.models.length} existing models`, { error: err });
      return provider.models;
    }
  }

  async persist(): Promise<void> {
    try {
      const providersWithoutKeys: Array<Omit<ProviderConfig, 'apiKey'>> = [];
      for (const provider of this.#providers.values()) {
        const { apiKey: _key, ...rest } = provider;
        providersWithoutKeys.push(rest);
      }
      await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(providersWithoutKeys) });
      debugLog('info', `[ProviderRegistry] persisted ${providersWithoutKeys.length} providers`);
    } catch (err) {
      debugLog('error', '[ProviderRegistry] persist failed', { error: err });
    }
  }

  async registerProvider(config: ProviderConfig): Promise<void> {
    if (this.#providers.has(config.id)) {
      throw new Error(`Provider "${config.id}" is already registered`);
    }

    this.#providers.set(config.id, config);
    await this.persist();
    debugLog('info', '[ProviderRegistry] registered', { providerId: config.id });
  }

  getProvider(
    providerId: string,
  ): { instance: unknown; config: ProviderConfig } | undefined {
    const config = this.#providers.get(providerId);
    if (!config) return undefined;

    const state = useProviderStore.getState();
    const apiKey = state.apiKeys[providerId] ||
                   state.apiKeys[config.name] ||
                   state.apiKeys[providerId.toLowerCase()] ||
                   config.apiKey;

    if (!apiKey) {
      return undefined;
    }

    const baseURL = config.baseURL || '';

    const cached = this.#instances.get(providerId);
    const cachedKey = this.#cachedKeys.get(providerId);
    const cachedBaseURL = this.#cachedBaseURLs.get(providerId);
    if (cached && cachedKey === apiKey && cachedBaseURL === baseURL) {
      return { instance: cached, config };
    }

    let instance: unknown;

    try {
      switch (config.type) {
        case 'openai':
          instance = createOpenAIAdapter(apiKey, baseURL);
          break;
        case 'anthropic':
          instance = createAnthropicAdapter(apiKey, baseURL);
          break;
        case 'google':
          instance = createGoogleAdapter(apiKey, baseURL);
          break;
        case 'ollama':
          instance = createOpenAICompatAdapter(apiKey, baseURL || 'http://localhost:11434/v1');
          break;
        case 'openai-compatible':
          instance = createOpenAICompatAdapter(apiKey, baseURL ?? '');
          break;
        default:
          debugLog('error', '[ProviderRegistry] unknown provider type', {
            providerId,
            type: (config as ProviderConfig & { type: string }).type,
          });
          return undefined;
      }
      this.#instances.set(providerId, instance);
      this.#cachedKeys.set(providerId, apiKey);
      this.#cachedBaseURLs.set(providerId, baseURL);
      return { instance, config };
    } catch (err) {
      debugLog('error', '[ProviderRegistry] failed to create provider instance', {
        providerId,
        error: err,
      });
      return undefined;
    }
  }

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

    result.sort((a, b) => {
      const pa = this.#providers.get(a.providerId);
      const pb = this.#providers.get(b.providerId);
      return (pa?.priority ?? 0) - (pb?.priority ?? 0);
    });

    return result;
  }

  listModels(): ModelEntry[] {
    const result: ModelEntry[] = [];

    for (const provider of this.#providers.values()) {
      if (!provider.enabled) continue;
      result.push(...provider.models);
    }

    result.sort((a, b) => {
      const pa = this.#providers.get(a.providerId);
      const pb = this.#providers.get(b.providerId);
      return (pa?.priority ?? 0) - (pb?.priority ?? 0);
    });

    return result;
  }

  listProviders(): ProviderConfig[] {
    return Array.from(this.#providers.values());
  }

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

  async removeProvider(providerId: string): Promise<void> {
    this.#providers.delete(providerId);
    this.#instances.delete(providerId);
    await this.persist();
    debugLog('info', '[ProviderRegistry] removed provider', { providerId });
  }
}

export const providerRegistry = new ProviderRegistry();
