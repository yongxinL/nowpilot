import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeStorageAdapter, flushPendingWrites, __test__ } from '../../../src/core/theme/chromeStorageAdapter';
import {
  migrateProviderSecrets,
  persistProviderConfigEncrypted,
  hydrateProviderSecrets,
  useExtensionStore,
} from '../../../src/store/useExtensionStore';
import type { ProviderConfig } from '../../../src/types';

async function getMapSnapshot(key: string): Promise<string | null> {
  return chromeStorageAdapter.getItem(key);
}

async function readJsonMapEntry(key: string): Promise<Record<string, unknown> | null> {
  const raw = await getMapSnapshot(key);
  if (!raw) return null;
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Build a ProviderConfig with one non-empty provider secret + openAiKey + geminiKey. */
function cfgWithSecrets(secret: string): ProviderConfig {
  return {
    serviceProvider: 'Custom API Key',
    activeProvider: 'openai',
    providers: {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        isConfigured: true,
        enabled: true,
        apiKey: secret,
        useCustomProxy: true,
        proxyUrl: 'https://api.openai.com/v1',
        models: [],
      },
      gemini: {
        id: 'gemini',
        name: 'Google (Gemini)',
        isConfigured: false,
        enabled: false,
        apiKey: '',
        useCustomProxy: false,
        proxyUrl: '',
        models: [],
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
      claude: {
        id: 'claude',
        name: 'Anthropic (Claude)',
        isConfigured: false,
        enabled: false,
        apiKey: '',
        useCustomProxy: false,
        proxyUrl: '',
        models: [],
      },
    },
    openAiKey: secret,
    openAiBaseUrl: 'https://api.openai.com/v1',
    geminiKey: '',
    selectedModel: '',
    fontSize: 'Auto',
    themeMode: 'Auto',
    language: 'English',
    sidepanelPosition: 'Right',
    chatGptWebappEnabled: false,
  };
}

async function seedLegacyNpStoreWith(secret: string): Promise<void> {
  const blob = {
    state: {
      config: cfgWithSecrets(secret),
      sessions: [],
      activeSessionId: '',
      prompts: [],
      writeHistory: [],
      notes: [],
      activeAttachments: [],
      availableTabs: [],
      activeSession: null,
    },
    version: 1,
  };
  await chromeStorageAdapter.setItem('np_store', JSON.stringify(blob));
  await flushPendingWrites();
}

describe('secrets-inspection — np_store→np_providers migration (D-28/D-29/D-30)', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();
    // Reset zustand store between tests so in-memory `config` starts at
    // DEFAULT_CONFIG (with empty secret fields) for every case.
    useExtensionStore.setState({
      // Reset to a minimal known state. We only need config here.
      config: useExtensionStore.getState().config,
    } as any);
  });

  it('migrates a legacy np_store carrying plaintext apiKey/openAiKey to encrypted np_providers + strips plaintext from np_store', async () => {
    const KNOWN_SECRET = 'sk-LIVE-MIGRATE-PLAINTEXT-2026-08-24';

    // Seed legacy np_store via the chrome.storage.local mock directly
    // (bypassing the partialize strip so the legacy plaintext lands).
    await seedLegacyNpStoreWith(KNOWN_SECRET);

    // Run the migration against the seeded legacy store.
    await migrateProviderSecrets();

    // 1. np_providers now holds ciphertext, NEVER the plaintext substring.
    const npProvidersBlob = (await getMapSnapshot('np_providers')) ?? '';
    expect(npProvidersBlob).not.toBe('');
    expect(npProvidersBlob).not.toContain(KNOWN_SECRET);

    // 2. np_store's secret fields are stripped.
    const npStoreBlob = await readJsonMapEntry('np_store');
    expect(npStoreBlob).not.toBeNull();
    const npStoreConfig = (npStoreBlob!.state as any).config as ProviderConfig;
    // All three secret categories are empty strings.
    expect(npStoreConfig.providers.openai.apiKey).toBe('');
    expect(npStoreConfig.openAiKey).toBe('');
    expect(npStoreConfig.geminiKey).toBe('');
    expect(npStoreConfig.providers.gemini.apiKey).toBe('');

    // 3. The serialized np_store blob also does NOT contain the plaintext.
    const npStoreRaw = (await getMapSnapshot('np_store')) ?? '';
    expect(npStoreRaw).not.toContain(KNOWN_SECRET);
  });

  it('running migrateProviderSecrets twice is a no-op (idempotent — np_providers blob byte-identical)', async () => {
    const KNOWN_SECRET = 'sk-LIVE-IDEMPOTENT-2026-08-24';

    await seedLegacyNpStoreWith(KNOWN_SECRET);

    await migrateProviderSecrets();
    const firstSnapshot = await getMapSnapshot('np_providers');
    const firstNpStore = await getMapSnapshot('np_store');

    await migrateProviderSecrets();
    const secondSnapshot = await getMapSnapshot('np_providers');
    const secondNpStore = await getMapSnapshot('np_store');

    expect(firstSnapshot).toBe(secondSnapshot);
    expect(firstNpStore).toBe(secondNpStore);
  });

  it('crash-order: process dies after np_providers write but before np_store strip → re-run completes the strip', async () => {
    const KNOWN_SECRET = 'sk-CRASH-ORDER-2026-08-24';

    await seedLegacyNpStoreWith(KNOWN_SECRET);

    // Run a single migration pass — but verify the ordering by checking
    // that after the np_providers write but BEFORE the np_store strip is
    // committed, the next invocation completes the strip.

    // Simulate the crash order: pre-populate np_providers (as if write
    // succeeded), KEEP plaintext in np_store, then re-run migrate.
    // We do this by performing the migration ourselves partially:
    // 1. seed the legacy np_store
    // 2. Run migrate once (it writes np_providers + strips np_store)
    // Now simulate the alternate ordering: write np_providers from a
    // fresh seed WITHOUT the strip step. We do this by:
    //   - calling migrateProviderSecrets
    //   - confirming both np_providers is set AND np_store is empty.
    // For the crash-order test, we check that re-running finish the
    // strip IF any plaintext leakage remained.
    await migrateProviderSecrets();

    // Force re-introduce legacy plaintext into np_store to mimic crash
    // scenario where np_providers was written but np_store was NOT
    // stripped.
    const npStoreBlob = await readJsonMapEntry('np_store');
    const npProvidersRaw = await getMapSnapshot('np_providers');
    expect(npProvidersRaw).not.toBeNull();
    expect(npProvidersRaw).not.toContain(KNOWN_SECRET);

    // Re-introduce plaintext into the np_store.config (simulating the
    // crash-during-strip state where the new np_providers is already
    // committed but the old plaintext leaked back into np_store).
    const tampered: any = { ...npStoreBlob };
    tampered.state.config.providers.openai.apiKey = KNOWN_SECRET;
    tampered.state.config.openAiKey = KNOWN_SECRET;
    await chromeStorageAdapter.setItem('np_store', JSON.stringify(tampered));
    await flushPendingWrites();

    // Now run migrate again — the migration MUST detect legacy plaintext
    // (because np_providers already exists with ciphertext, but np_store
    // STILL has plaintext) and complete the strip... but the migration
    // intentionally skips re-encryption when np_providers already exists.
    // The crash-order contract is: re-run completes the STRIP even if
    // np_providers is already present with content.

    // The migration in this implementation skips re-encryption but ALWAYS
    // re-runs the strip step on a legacy np_store to close the
    // crash-order window. Verify that:
    await migrateProviderSecrets();

    const finalNpStoreRaw = (await getMapSnapshot('np_store')) ?? '';
    expect(finalNpStoreRaw).not.toContain(KNOWN_SECRET);
  });

  it('inspection gate: after a provider save with a known key, neither np_store nor np_providers contains the plaintext substring', async () => {
    const KNOWN_SECRET = 'sk-LIVE-INSPECTION-2026-08-24';

    await seedLegacyNpStoreWith(KNOWN_SECRET);
    await migrateProviderSecrets();

    // Now save a new provider config via persistProviderConfigEncrypted.
    // Pretend the user added a new (fresh) key for the gemini provider.
    const currentConfig = useExtensionStore.getState().config;
    const newConfig: ProviderConfig = {
      ...currentConfig,
      providers: {
        ...currentConfig.providers,
        gemini: {
          ...currentConfig.providers.gemini,
          apiKey: KNOWN_SECRET,
          isConfigured: true,
        },
      },
      geminiKey: KNOWN_SECRET,
    };
    useExtensionStore.setState({ config: newConfig } as any);
    await persistProviderConfigEncrypted(newConfig);

    // Flush any pending writes before inspection.
    await flushPendingWrites();

    const npStoreRaw = (await getMapSnapshot('np_store')) ?? '';
    const npProvidersRaw = (await getMapSnapshot('np_providers')) ?? '';

    // Plaintext substring must NOT be present in either blob.
    expect(npStoreRaw).not.toContain(KNOWN_SECRET);
    expect(npProvidersRaw).not.toContain(KNOWN_SECRET);
  });

  it('hydrateProviderSecrets: decrypt-on-read reload populates in-memory config from np_providers without writing storage', async () => {
    const KNOWN_SECRET = 'sk-LIVE-HYDRATE-2026-08-24';

    await seedLegacyNpStoreWith(KNOWN_SECRET);
    await migrateProviderSecrets();

    // Simulate a fresh boot: reset the zustand in-memory state to defaults
    // (apiKey/openAiKey/geminiKey all empty), then hydrate.
    const defaultsOnly: ProviderConfig = {
      ...useExtensionStore.getState().config,
      providers: {
        openai: { ...useExtensionStore.getState().config.providers.openai, apiKey: '' },
        gemini: { ...useExtensionStore.getState().config.providers.gemini, apiKey: '' },
        ollama: { ...useExtensionStore.getState().config.providers.ollama, apiKey: '' },
        claude: { ...useExtensionStore.getState().config.providers.claude, apiKey: '' },
      },
      openAiKey: '',
      geminiKey: '',
    };
    useExtensionStore.setState({ config: defaultsOnly } as any);

    // Snapshot storage BEFORE hydrate.
    const npStoreBefore = await getMapSnapshot('np_store');
    const npProvidersBefore = await getMapSnapshot('np_providers');

    // Hydrate from the encrypted np_providers blob.
    await hydrateProviderSecrets();

    // After hydrate, the in-memory config should now contain the
    // decrypted values.
    const hydrated = useExtensionStore.getState().config;
    expect(hydrated.providers.openai.apiKey).toBe(KNOWN_SECRET);
    expect(hydrated.openAiKey).toBe(KNOWN_SECRET);

    // Hydrate is read-only — it must NOT mutate the persisted blobs.
    const npStoreAfter = await getMapSnapshot('np_store');
    const npProvidersAfter = await getMapSnapshot('np_providers');
    expect(npStoreAfter).toBe(npStoreBefore);
    expect(npProvidersAfter).toBe(npProvidersBefore);
  });

  it('hydrateProviderSecrets is read-only: source contains no chromeStorageAdapter.setItem for np_providers or np_store', async () => {
    // This is a code-level assertion: read the source file and confirm no
    // persisted write for np_providers or np_store inside hydrateProviderSecrets.
    const fs = await import('fs');
    const path = await import('path');
    const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'store', 'useExtensionStore.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');

    // Slice out the hydrateProviderSecrets function body.
    const match = source.match(/export\s+async\s+function\s+hydrateProviderSecrets\s*\([^)]*\)\s*:\s*Promise<void>\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).not.toMatch(/setItem\s*\(\s*['"]np_providers['"]/);
    expect(body).not.toMatch(/setItem\s*\(\s*['"]np_store['"]/);
  });
});
