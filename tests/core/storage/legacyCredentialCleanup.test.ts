import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CLEANUP_SCHEMA_VERSION,
  LEGACY_SECRET_FIELDS,
  runLegacyCredentialCleanup,
  sanitizeLegacyProviderConfig,
} from '../../../src/core/storage/legacyCredentialCleanup';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * Legacy plaintext credential cleanup suite (plan `01-10`, Task 2 — D-07).
 *
 * Six non-negotiable properties, each with its own case (RESEARCH § Pattern 6):
 *   1. idempotent — a second run removes nothing and returns deep-equal output;
 *   2. redacted — the report and every log line carry field NAMES only, and no
 *      derived value (length, prefix, suffix, hash, fingerprint) is produced;
 *   3. preserving — every authorised non-secret field survives unchanged;
 *   4. non-relocating — after the run the sentinel is absent from the report,
 *      the output, the log buffer, the persisted store, session storage and
 *      both per-origin stores;
 *   5. versioned — a sanitised record carries the cleanup schema version;
 *   6. total — `null`, `undefined`, an empty object, an array, a string and a
 *      number each return a safe value with an empty removal list and no throw.
 *
 * The credential is the repository's synthetic sentinel — never a real key.
 */

const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';
const STORAGE_KEY = 'np_store';
/** The stamped field name — pinned here so the version claim is asserted. */
const CLEANUP_VERSION_FIELD = 'plaintextCleanupSchemaVersion';

/** The chrome.storage.local mock's backing map (see `tests/setup.ts`). */
const storageMap = () => (globalThis as any).__chromeStorageMap as Map<string, unknown>;

/** A prototype-shaped persisted blob carrying a plaintext credential. */
function legacyStoreBlob(): Record<string, unknown> {
  return {
    state: {
      config: {
        serviceProvider: 'Custom API Key',
        activeProvider: 'openai',
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            isConfigured: true,
            enabled: true,
            apiKey: SENTINEL,
            useCustomProxy: true,
            proxyUrl: 'http://localhost:12380/v1',
            models: [{ id: 'm-1', name: 'm-1', enabled: true }],
          },
          gemini: {
            id: 'gemini',
            name: 'Google (Gemini)',
            isConfigured: false,
            enabled: false,
            apiKey: SENTINEL,
            useCustomProxy: false,
            proxyUrl: 'https://generativelanguage.googleapis.com',
            models: [],
          },
        },
        openAiKey: SENTINEL,
        openAiBaseUrl: 'http://localhost:12380/v1',
        geminiKey: SENTINEL,
        selectedModel: 'gpt-4o',
        themeMode: 'Auto',
      },
    },
    version: 1,
  };
}

/** The same blob with no recognised credential field anywhere. */
function cleanStoreBlob(): Record<string, unknown> {
  return {
    state: {
      config: {
        serviceProvider: 'Custom API Key',
        activeProvider: 'openai',
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            isConfigured: false,
            enabled: false,
            useCustomProxy: true,
            proxyUrl: 'http://localhost:12380/v1',
            models: [],
          },
        },
        openAiBaseUrl: 'http://localhost:12380/v1',
        selectedModel: 'gpt-4o',
      },
    },
    version: 1,
  };
}

/** Everything a storage area currently holds, serialised for a sentinel scan. */
function serialisedStorage(): string {
  return JSON.stringify({
    local: Array.from(storageMap().entries()),
    session: Array.from(sessionMap.entries()),
    localStorage: Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.getItem(localStorage.key(i) as string),
    ),
    sessionStorage: Array.from({ length: sessionStorage.length }, (_, i) =>
      sessionStorage.getItem(sessionStorage.key(i) as string),
    ),
  });
}

/** Map-backed `chrome.storage.session` stand-in (the setup mock has no session area). */
const sessionMap = new Map<string, unknown>();

function installSessionArea(): void {
  (chrome.storage as unknown as Record<string, unknown>).session = {
    get: (keys?: string | string[]): Promise<Record<string, unknown>> => {
      if (typeof keys === 'string') return Promise.resolve({ [keys]: sessionMap.get(keys) });
      return Promise.resolve(Object.fromEntries(sessionMap));
    },
    set: (items: Record<string, unknown>): Promise<void> => {
      for (const [key, value] of Object.entries(items)) sessionMap.set(key, value);
      return Promise.resolve();
    },
    remove: (keys: string | string[]): Promise<void> => {
      for (const key of Array.isArray(keys) ? keys : [keys]) sessionMap.delete(key);
      return Promise.resolve();
    },
  };
}

beforeEach(() => {
  storageMap().clear();
  sessionMap.clear();
  localStorage.clear();
  sessionStorage.clear();
  clearLogs();
  installSessionArea();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('legacyCredentialCleanup — the recognised field set', () => {
  it('names exactly the recognised legacy credential fields, both nested and top-level', () => {
    expect([...LEGACY_SECRET_FIELDS].sort()).toEqual(
      ['accessToken', 'apiKey', 'geminiKey', 'openAiKey', 'secret', 'token'].sort(),
    );
  });
});

describe('legacyCredentialCleanup — sanitizeLegacyProviderConfig', () => {
  it('removes a recognised credential field and preserves every other field byte-for-byte', () => {
    const report = sanitizeLegacyProviderConfig(legacyStoreBlob());
    const config = (report.value as any).state.config;

    expect(report.found).toBe(true);
    expect(config.providers.openai).toEqual({
      id: 'openai',
      name: 'OpenAI',
      isConfigured: true,
      enabled: true,
      useCustomProxy: true,
      proxyUrl: 'http://localhost:12380/v1',
      models: [{ id: 'm-1', name: 'm-1', enabled: true }],
    });
    expect(config.providers.gemini).toEqual({
      id: 'gemini',
      name: 'Google (Gemini)',
      isConfigured: false,
      enabled: false,
      useCustomProxy: false,
      proxyUrl: 'https://generativelanguage.googleapis.com',
      models: [],
    });
    expect(config.openAiBaseUrl).toBe('http://localhost:12380/v1');
    expect(config.selectedModel).toBe('gpt-4o');
    expect(config.themeMode).toBe('Auto');
  });

  it('removes recognised fields at the nested provider level and at the record top level', () => {
    const report = sanitizeLegacyProviderConfig(legacyStoreBlob());
    const config = (report.value as any).state.config;

    expect(config.providers.openai).not.toHaveProperty('apiKey');
    expect(config.providers.gemini).not.toHaveProperty('apiKey');
    expect(config).not.toHaveProperty('openAiKey');
    expect(config).not.toHaveProperty('geminiKey');
    // Names only — one entry per recognised name, never one per occurrence.
    expect(report.removedFields).toEqual(['apiKey', 'geminiKey', 'openAiKey']);
  });

  it('reports field names only — no value, length, prefix, suffix or derived fragment', () => {
    const report = sanitizeLegacyProviderConfig(legacyStoreBlob());
    const serialised = JSON.stringify(report);

    expect(report.removedFields).toEqual(['apiKey', 'geminiKey', 'openAiKey']);
    // The report has exactly three places a value could hide, and none of them
    // carries one: the names array is pinned exactly and the other two are the
    // sanitised output and a boolean.
    expect(Object.keys(report).sort()).toEqual(['found', 'removedFields', 'value']);
    expect(JSON.stringify(report.removedFields)).toBe('["apiKey","geminiKey","openAiKey"]');
    expect(serialised).not.toContain(SENTINEL);
    expect(serialised).not.toContain(SENTINEL.slice(0, 10));
    expect(serialised).not.toContain(SENTINEL.slice(-6));
  });

  it('is idempotent — a second run removes nothing and returns deep-equal output', () => {
    const first = sanitizeLegacyProviderConfig(legacyStoreBlob());
    const second = sanitizeLegacyProviderConfig(first.value);

    expect(first.removedFields).toEqual(['apiKey', 'geminiKey', 'openAiKey']);
    expect(second.found).toBe(false);
    expect(second.removedFields).toEqual([]);
    expect(second.value).toEqual(first.value);
  });

  it('stamps the sanitised output with the plaintext-cleanup schema version', () => {
    const report = sanitizeLegacyProviderConfig(legacyStoreBlob());

    expect(CLEANUP_SCHEMA_VERSION).toBe(1);
    expect((report.value as Record<string, unknown>)[CLEANUP_VERSION_FIELD]).toBe(
      CLEANUP_SCHEMA_VERSION,
    );
    // The stamp survives a re-run untouched (it is part of the sanitised shape).
    const second = sanitizeLegacyProviderConfig(report.value);
    expect((second.value as Record<string, unknown>)[CLEANUP_VERSION_FIELD]).toBe(
      CLEANUP_SCHEMA_VERSION,
    );
  });

  it('returns a record with only non-secret fields unchanged with an empty removal list', () => {
    const raw = cleanStoreBlob();
    const report = sanitizeLegacyProviderConfig(raw);

    expect(report.found).toBe(false);
    expect(report.removedFields).toEqual([]);
    expect((report.value as any).state.config.providers.openai).toEqual(
      (raw as any).state.config.providers.openai,
    );
  });

  it('is total — null, undefined, an empty object, an array, a string and a number never throw', () => {
    const raws: unknown[] = [null, undefined, {}, [], 'nonsense', 42];

    for (const raw of raws) {
      expect(() => sanitizeLegacyProviderConfig(raw), `raw ${JSON.stringify(raw)}`).not.toThrow();
      const report = sanitizeLegacyProviderConfig(raw);
      expect(report.found, `raw ${JSON.stringify(raw)}`).toBe(false);
      expect(report.removedFields, `raw ${JSON.stringify(raw)}`).toEqual([]);
      expect(report.value, `raw ${JSON.stringify(raw)}`).toBe(raw);
    }
  });

  it('returns a serialisable report even for a cyclic input — no cycle survives', () => {
    const cyclic: Record<string, unknown> = { id: 'provider', apiKey: SENTINEL };
    cyclic.self = cyclic;

    const report = sanitizeLegacyProviderConfig(cyclic);

    expect(report.removedFields).toEqual(['apiKey']);
    expect(() => JSON.stringify(report)).not.toThrow();
    expect(JSON.stringify(report)).not.toContain(SENTINEL);
  });
});

describe('legacyCredentialCleanup — runLegacyCredentialCleanup', () => {
  it('destroys the credential in place and relocates it nowhere', async () => {
    storageMap().set(STORAGE_KEY, JSON.stringify(legacyStoreBlob()));
    expect(serialisedStorage()).toContain(SENTINEL);

    const result = await runLegacyCredentialCleanup();

    expect(result).toEqual({ ok: true });
    const persisted = storageMap().get(STORAGE_KEY) as string;
    expect(persisted).not.toContain(SENTINEL);
    expect(JSON.parse(persisted).state.config).not.toHaveProperty('openAiKey');
    expect(JSON.parse(persisted).state.config.providers.openai).not.toHaveProperty('apiKey');
    // No relocation: the value is absent from every storage area afterwards.
    expect(serialisedStorage()).not.toContain(SENTINEL);
  });

  it('logs the removal with a SCREAMING_SNAKE code and field names only', async () => {
    storageMap().set(STORAGE_KEY, JSON.stringify(legacyStoreBlob()));

    await runLegacyCredentialCleanup();

    const logs = getRecentLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((entry) => /^[A-Z][A-Z0-9_]+$/.test(entry.code))).toBe(true);
    expect(JSON.stringify(logs)).toContain('apiKey');
    expect(JSON.stringify(logs)).not.toContain(SENTINEL);
    expect(JSON.stringify(logs)).not.toContain(SENTINEL.slice(0, 10));
  });

  it('writes back only when a removal occurred', async () => {
    storageMap().set(STORAGE_KEY, JSON.stringify(cleanStoreBlob()));
    const setSpy = vi.spyOn(chrome.storage.local, 'set');

    const result = await runLegacyCredentialCleanup();

    expect(result).toEqual({ ok: true });
    expect(setSpy).not.toHaveBeenCalled();
    expect(storageMap().get(STORAGE_KEY)).toBe(JSON.stringify(cleanStoreBlob()));
  });

  it('is a soft success when no chrome storage is available', async () => {
    const storage = chrome.storage as unknown as Record<string, unknown>;
    const local = storage.local;

    try {
      storage.local = undefined;
      const result = await runLegacyCredentialCleanup();
      expect(result).toEqual({ ok: true });
    } finally {
      storage.local = local;
    }
  });

  it('is total for a missing key and for an unparseable stored value', async () => {
    const missing = await runLegacyCredentialCleanup();
    expect(missing).toEqual({ ok: true });

    storageMap().set(STORAGE_KEY, '{not json');
    const unparseable = await runLegacyCredentialCleanup();
    expect(unparseable).toEqual({ ok: true });
  });

  it('reports a typed failure instead of throwing when the storage write rejects', async () => {
    storageMap().set(STORAGE_KEY, JSON.stringify(legacyStoreBlob()));
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('quota exceeded'));

    const result = await runLegacyCredentialCleanup();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toMatch(/^[A-Z][A-Z0-9_]+$/);
    // The failure is logged without the value it could not delete.
    expect(JSON.stringify(getRecentLogs())).not.toContain(SENTINEL);
  });
});
