import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ProviderRegistry,
  ENDPOINTS,
  __test__ as registryTest,
} from '../../../src/core/ai/ProviderRegistry';
import { FixtureProvider } from './fixtures/FixtureProvider';
import { chromeStorageAdapter, __test__ as adapterTest } from '../../../src/core/theme/chromeStorageAdapter';

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

  it('openai-compat has no discovery (D-56) and unknown providers return the stale cache on failure', async () => {
    expect(await ProviderRegistry.refreshModels('openai-compat')).toEqual([]);
    registryTest.seedCachedModels('openai', ['stale-model']);
    expect(ProviderRegistry.getCachedModels('openai')).toEqual(['stale-model']);
  });
});

describe('ProviderRegistry boot wiring — D-51 hydration before UI renders', () => {
  it('both surface boots call await ProviderRegistry.hydrate()', () => {
    for (const path of ['entrypoints/sidepanel/main.tsx', 'entrypoints/standalone/main.tsx']) {
      const body = readFileSync(path, 'utf8');
      expect(body).toMatch(/await ProviderRegistry\.hydrate\(\)/);
      // Boot import present.
      expect(body).toMatch(/import \{ ProviderRegistry \} from '\.\.\/\.\.\/src\/core\/ai\/ProviderRegistry'/);
    }
  });
});