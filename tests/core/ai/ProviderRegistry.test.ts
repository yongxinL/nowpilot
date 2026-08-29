import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ProviderRegistry,
  ENDPOINTS,
  __test__ as registryTest,
} from '../../../src/core/ai/ProviderRegistry';
import { FixtureProvider } from './fixtures/FixtureProvider';
import { chromeStorageAdapter, __test__ as adapterTest } from '../../../src/core/theme/chromeStorageAdapter';
import {
  persistProviderConfigEncrypted,
  hydrateProviderSecrets,
  migrateProviderSecrets,
  useExtensionStore,
} from '../../../src/store/useExtensionStore';
import type { ProviderConfig } from '../../../src/types';

/**
 * ProviderRegistry tests (plan 03-05, Task 1 — additive test file proving the
 * Task 1 acceptance criteria repeatably: D-49 normalize + disk-unchanged,
 * D-50 endpoint override merge + T-3-16 validation, D-51 sync reads +
 * declarative registration, D-52 session cache).
 */
const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

/** Write a value into the mock chrome.storage.local map, bypassing the
 * debounced adapter (seeding, not production writes). */
function seedStorage(key: string, value: unknown): void {
  storageMap.set(key, typeof value === 'string' ? value : JSON.stringify(value));
}

const diskShape = {
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: true,
      enabled: true,
      apiKey: 'sk-plaintext',
      useCustomProxy: false,
      proxyUrl: '',
      models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true }],
    },
    claude: {
      id: 'claude',
      name: 'Claude',
      isConfigured: true,
      enabled: true,
      apiKey: { salt: 's', iv: 'i', ciphertext: 'c' }, // EncryptedBlob passes through opaque
      useCustomProxy: false,
      proxyUrl: '',
      models: [{ id: 'claude-3-5-haiku-20241022', name: 'haiku', enabled: true }],
    },
    ollama: {
      id: 'ollama',
      name: 'Ollama',
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: false,
      proxyUrl: '',
      models: [],
    },
  },
  openAiKey: 'sk-plaintext',
  geminiKey: '',
};

beforeEach(() => {
  storageMap.clear();
  adapterTest.resetPendingState();
  registryTest.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProviderRegistry.hydrate — D-49 normalize-in-memory', () => {
  it('maps disk "claude" to runtime "anthropic"; disk np_providers object is byte-unchanged (reads never write)', async () => {
    seedStorage('np_providers', diskShape);
    await ProviderRegistry.hydrate();

    const anthropic = ProviderRegistry.getById('anthropic');
    expect(anthropic).toBeDefined();
    expect(anthropic!.id).toBe('anthropic');
    expect(anthropic!.name).toBe('Claude');
    expect(anthropic!.isConfigured).toBe(true);
    expect(anthropic!.enabled).toBe(true);
    // EncryptedBlob apiKey passes through opaque — no crypto here (V6).
    expect(anthropic!.apiKey).toEqual({ salt: 's', iv: 'i', ciphertext: 'c' });
    expect(anthropic!.models).toEqual(['claude-3-5-haiku-20241022']);

    const openai = ProviderRegistry.getById('openai');
    expect(openai).toBeDefined();
    expect(openai!.models).toEqual(['gpt-4o-mini']);

    // Disk shape untouched — registry reads never write storage (D-49).
    expect(storageMap.get('np_providers')).toBe(JSON.stringify(diskShape));
  });

  it('exposes isHydrated() true after hydrate() completes', async () => {
    expect(ProviderRegistry.isHydrated()).toBe(false);
    await ProviderRegistry.hydrate();
    expect(ProviderRegistry.isHydrated()).toBe(true);
  });

  it('hydrates a real encrypted np_providers save — openAiKey/geminiKey as EncryptedBlob objects must not fail the whole parse', async () => {
    // persistProviderConfigEncrypted writes the full ProviderConfig with
    // top-level openAiKey/geminiKey encrypted to EncryptedBlob objects (not
    // strings) whenever the operator has configured a key. DiskProviderConfig
    // Schema must accept both forms or the entire np_providers parse fails
    // → every provider stays enabled:false → "Discover models" finds nothing
    // and resolveTier always returns configuration_required.
    seedStorage('np_providers', {
      serviceProvider: 'Custom API Key',
      providers: {
        openai: {
          id: 'openai',
          name: 'OpenAI',
          isConfigured: true,
          enabled: true,
          apiKey: { salt: 's1', iv: 'i1', ciphertext: 'c1' },
          useCustomProxy: true,
          proxyUrl: 'https://my-proxy.example.com/v1',
          models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true }],
        },
      },
      openAiKey: { salt: 's2', iv: 'i2', ciphertext: 'c2' },
      geminiKey: '',
      openAiBaseUrl: '',
      fontSize: 'Auto',
      themeMode: 'Auto',
    });
    await ProviderRegistry.hydrate();

    // The configured provider normalizes as enabled (not the module-load
    // enabled:false default) with its models seeded into the D-52 cache.
    const openai = ProviderRegistry.getById('openai');
    expect(openai).toBeDefined();
    expect(openai!.enabled).toBe(true);
    expect(ProviderRegistry.getEnabled().map((p) => p.providerId)).toEqual(['openai']);
    expect(ProviderRegistry.getCachedModels('openai')).toEqual(['gpt-4o-mini']);
  });
});

describe('ProviderRegistry.getEndpointFor — D-50 §10.6 defaults + override merge', () => {
  it('returns §10.6 defaults when no overrides exist', async () => {
    await ProviderRegistry.hydrate();
    expect(ProviderRegistry.getEndpointFor('openai')).toBe('https://api.openai.com/v1');
    expect(ProviderRegistry.getEndpointFor('anthropic')).toBe('https://api.anthropic.com');
    expect(ProviderRegistry.getEndpointFor('gemini')).toBe(
      'https://generativelanguage.googleapis.com',
    );
    expect(ProviderRegistry.getEndpointFor('ollama')).toBe('http://localhost:11434/v1');
    expect(ProviderRegistry.getEndpointFor('openai-compat')).toBeUndefined(); // D-56
    expect(ENDPOINTS).toEqual({
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      gemini: 'https://generativelanguage.googleapis.com',
      ollama: 'http://localhost:11434/v1',
    });
  });

  it('merges np_endpoint_overrides over the defaults at load (D-50)', async () => {
    seedStorage(
      'np_endpoint_overrides',
      { openai: 'http://localhost:12345/v1', 'openai-compat': 'http://localhost:9999/v1' },
    );
    await ProviderRegistry.hydrate();
    expect(ProviderRegistry.getEndpointFor('openai')).toBe('http://localhost:12345/v1');
    expect(ProviderRegistry.getEndpointFor('anthropic')).toBe('https://api.anthropic.com');
    expect(ProviderRegistry.getEndpointFor('openai-compat')).toBe('http://localhost:9999/v1');
  });

  it('rejects non-http(s) override values at hydrate — falls back to the default (T-3-16)', async () => {
    seedStorage('np_endpoint_overrides', { openai: 'ftp://evil.example.com/keys' });
    await ProviderRegistry.hydrate();
    // The invalid value never reaches the fetch layer — the §10.6 default wins.
    expect(ProviderRegistry.getEndpointFor('openai')).toBe('https://api.openai.com/v1');
  });
});

describe('ProviderRegistry sync read surface — D-51', () => {
  it('getEnabled returns only registered + enabled providers (synchronously)', async () => {
    seedStorage('np_providers', diskShape);
    await ProviderRegistry.hydrate();
    const enabled = ProviderRegistry.getEnabled();
    expect(enabled.map((p) => p.providerId).sort()).toEqual(['anthropic', 'openai']);
    // All returned instances are the registered ILLMProvider singletons.
    for (const p of enabled) {
      expect(ProviderRegistry.getById(p.providerId)?.provider).toBe(p);
    }
  });

  it('getAll returns every normalized provider including registered-but-unconfigured', async () => {
    await ProviderRegistry.hydrate();
    const all = ProviderRegistry.getAll();
    expect(all.map((n) => n.id).sort()).toEqual([
      'anthropic',
      'gemini',
      'ollama',
      'openai',
    ]);
  });

  it('registerProvider registers a fixture provider declaratively', () => {
    const fixture = new FixtureProvider([], { providerId: 'openai-compat' });
    ProviderRegistry.registerProvider(fixture);
    expect(ProviderRegistry.getById('openai-compat')?.provider).toBe(fixture);
    expect(ProviderRegistry.getAll().some((n) => n.id === 'openai-compat')).toBe(true);
  });
});

describe('ProviderRegistry D-52 live-model session cache', () => {
  it('refreshModels fetches via the merged endpoint and caches the list in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const models = await ProviderRegistry.refreshModels('openai');
    expect(models).toEqual(['gpt-4o-mini', 'gpt-4o']);
    expect(ProviderRegistry.getCachedModels('openai')).toEqual(['gpt-4o-mini', 'gpt-4o']);
    // D-50: the merged §10.6 default endpoint is what reaches the network.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.anything(),
    );
  });

  it('CR-02: hydrate seeds the D-52 cache from the disk model list — stale-but-present beats never-populated', async () => {
    seedStorage('np_providers', diskShape);
    await ProviderRegistry.hydrate();
    expect(ProviderRegistry.getCachedModels('openai')).toEqual(['gpt-4o-mini']);
    expect(ProviderRegistry.getCachedModels('anthropic')).toEqual(['claude-3-5-haiku-20241022']);
    expect(ProviderRegistry.getCachedModels('ollama')).toEqual([]);
  });

  it('openai-compat has no discovery (D-56) and unknown providers return the stale cache on failure', async () => {
    expect(await ProviderRegistry.refreshModels('openai-compat')).toEqual([]);
    registryTest.seedCachedModels('openai', ['stale-model']);
    expect(ProviderRegistry.getCachedModels('openai')).toEqual(['stale-model']);
  });
});

describe('ProviderRegistry.buildForRoute — CR-01 per-route instance construction', () => {
  it('builds a fresh configured instance from the merged endpoint + key + model', async () => {
    seedStorage('np_providers', diskShape);
    seedStorage('np_endpoint_overrides', { openai: 'http://localhost:12345/v1' });
    await ProviderRegistry.hydrate();

    const built = ProviderRegistry.buildForRoute('openai', {
      model: 'gpt-4o-mini',
      apiKey: 'sk-decrypted',
    });
    expect(built).toBeDefined();
    expect(built!.providerId).toBe('openai');
    // NOT the config-empty module-load singleton — a fresh per-route instance.
    expect(built).not.toBe(ProviderRegistry.getById('openai')?.provider);
  });

  it('routes a caller-registered instance (test fixture, D-48) through as-is', async () => {
    const fixture = new FixtureProvider([], { providerId: 'openai' });
    ProviderRegistry.registerProvider(fixture);
    const built = ProviderRegistry.buildForRoute('openai', { model: 'gpt-4o-mini' });
    expect(built).toBe(fixture);
  });

  it('returns undefined for openai-compat without an assigned endpoint (D-56)', () => {
    expect(ProviderRegistry.buildForRoute('openai-compat', { model: 'm' })).toBeUndefined();
  });
});

describe('ProviderRegistry boot wiring — D-51 hydration before UI renders', () => {
  it('all surface boots call await ProviderRegistry.hydrate()', () => {
    for (const path of [
      'entrypoints/sidepanel/main.tsx',
      'entrypoints/standalone/main.tsx',
      'entrypoints/options/main.tsx',
    ]) {
      const body = readFileSync(path, 'utf8');
      expect(body).toMatch(/await ProviderRegistry\.hydrate\(\)/);
      // Boot import present.
      expect(body).toMatch(/import \{ ProviderRegistry \} from '\.\.\/\.\.\/src\/core\/ai\/ProviderRegistry'/);
    }
  });

  it('Options boot sequence decrypts the saved key and hydrates the registry — "Check connection" + "Discover models" work after a reopen', async () => {
    // Step 1 — the Options save path (persistProviderConfigEncrypted): a
    // provider config carrying a plaintext key becomes np_providers with
    // EncryptedBlob fields (openai.apiKey + top-level openAiKey).
    const KEY = 'sk-options-boot-test';
    const saveConfig: ProviderConfig = {
      ...useExtensionStore.getState().config,
      providers: {
        ...useExtensionStore.getState().config.providers,
        openai: {
          ...useExtensionStore.getState().config.providers.openai,
          id: 'openai',
          name: 'OpenAI',
          isConfigured: true,
          enabled: true,
          apiKey: KEY,
          useCustomProxy: true,
          proxyUrl: 'https://my-proxy.example.com/v1',
          models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true }],
        },
      },
      openAiKey: KEY,
    };
    useExtensionStore.setState({ config: saveConfig });
    await persistProviderConfigEncrypted(saveConfig);

    // Step 2 — simulate a fresh Options page load: the zustand store
    // rehydrates the STRIPPED np_store (no plaintext in memory), the
    // registry sits at module-load defaults (enabled: false).
    useExtensionStore.setState({
      config: {
        ...saveConfig,
        providers: {
          ...saveConfig.providers,
          openai: { ...saveConfig.providers.openai, apiKey: '' },
        },
        openAiKey: '',
      },
    });
    registryTest.reset();

    // Step 3 — the exact Options boot (entrypoints/options/main.tsx):
    // migrateProviderSecrets → hydrateProviderSecrets → ProviderRegistry.hydrate.
    await migrateProviderSecrets();
    await hydrateProviderSecrets();
    await ProviderRegistry.hydrate();

    // "Check connection" receives a decrypted in-memory key.
    expect(useExtensionStore.getState().config.providers.openai.apiKey).toBe(KEY);
    // "Discover models" sees the enabled provider with a seeded model cache.
    expect(ProviderRegistry.getEnabled().map((p) => p.providerId)).toEqual(['openai']);
    expect(ProviderRegistry.getCachedModels('openai')).toEqual(['gpt-4o-mini']);
  });
});

describe('ProviderRegistry.setEnabled — Options enable-toggle sync', () => {
  it('flips the in-memory enabled flag so getEnabled reflects the toggle on the same tick', async () => {
    seedStorage('np_providers', diskShape); // openai + claude enabled, gemini/ollama disabled
    await ProviderRegistry.hydrate();

    // Sanity: gemini is disabled on disk.
    expect(ProviderRegistry.getEnabled().map((p) => p.providerId).sort()).toEqual([
      'anthropic',
      'openai',
    ]);

    // Operator toggles Gemini on in Options — the Zustand store writes
    // np_store, NOT np_providers, so the registry must be patched in place.
    ProviderRegistry.setEnabled('gemini', true);
    expect(ProviderRegistry.getEnabled().map((p) => p.providerId).sort()).toEqual([
      'anthropic',
      'gemini',
      'openai',
    ]);

    // Toggling back off removes it again.
    ProviderRegistry.setEnabled('gemini', false);
    expect(ProviderRegistry.getEnabled().map((p) => p.providerId).sort()).toEqual([
      'anthropic',
      'openai',
    ]);
  });

  it('is a no-op for an unregistered provider (no entry to mutate)', async () => {
    await ProviderRegistry.hydrate();
    // OpenAICompat has no §10.6 default; with no endpoint override it's not
    // registered, so setEnabled must not throw.
    expect(() => ProviderRegistry.setEnabled('openai-compat', true)).not.toThrow();
    expect(ProviderRegistry.getEnabled()).toEqual([]);
  });
});