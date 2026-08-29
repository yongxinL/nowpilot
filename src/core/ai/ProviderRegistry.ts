import { z } from 'zod';
import type { ILLMProvider } from './ILLMProvider';
import type { ProviderId } from './types';
import type { CustomProviderId } from '../../types';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';
import { debugLog } from '../log/debugLog';
import { fetchModelsOrError } from '../../services/aiProvider';
import type { EncryptedBlob } from '../storage/EncryptedStorage';
import { openaiProvider, OpenAIProvider } from './providers/OpenAIProvider';
import { anthropicProvider, AnthropicProvider } from './providers/AnthropicProvider';
import { geminiProvider, GeminiProvider } from './providers/GeminiProvider';
import { ollamaProvider, OllamaProvider } from './providers/OllamaProvider';
import { OpenAICompatProvider } from './providers/OpenAICompatProvider';

/**
 * ProviderRegistry — D-49 normalize-in-memory, D-50 endpoint overrides,
 * D-51 declarative registration + sync reads, D-52 live-model session cache
 * (plan 03-05, Task 1).
 *
 * Contracts:
 * - D-49: `hydrate()` reads the Phase-2 disk shape
 *   `{ providers: Record<CustomProviderId, CustomProviderDetail>, openAiKey,
 *   geminiKey }` (src/types/index.ts:94-137) and normalizes it IN MEMORY.
 *   The persisted `np_providers` key keeps the Phase-2 object shape — no
 *   disk rewrite, no migration. Disk 'claude' maps to runtime 'anthropic'
 *   ONLY at this boundary; the disk shape is never touched (registry reads
 *   never write storage).
 * - D-50: `np_endpoint_overrides` (chrome.storage.local) merge over the
 *   §10.6 ENDPOINTS defaults at hydrate. `localhost:12380` is NEVER a
 *   canonical default (D-12). Override values are zod-validated at read
 *   (http/https scheme only — T-3-16).
 * - D-51: providers register declaratively (`registerProvider`); the four
 *   plan-03-03 singletons register at module load. `getEnabled()`,
 *   `getById(id)`, `getAll()` are SYNCHRONOUS — `hydrate()` must complete
 *   before reads (boot wiring awaits it).
 * - D-52: live model discovery reuses `fetchModelsOrError` semantics from
 *   src/services/aiProvider.ts (passing the merged endpoint as proxyUrl);
 *   fetched lists are cached per provider in memory for the session
 *   (`getCachedModels(providerId)`).
 *
 * No crypto lives here (V6 — no new crypto): encrypted `apiKey` blobs pass
 * through opaque. Decryption stays in useExtensionStore's read path.
 */

/** §10.6 canonical endpoints (spec 1630-1635). D-12: localhost:12380 never appears. */
export const ENDPOINTS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  ollama: 'http://localhost:11434/v1',
} as const;

/** Normalized in-memory provider record (D-49) — the read-surface unit. */
export interface NormalizedProvider {
  /** Runtime provider id — disk 'claude' is mapped to 'anthropic' here (D-49). */
  id: ProviderId;
  name: string;
  isConfigured: boolean;
  enabled: boolean;
  /**
   * Opaque apiKey passthrough — an EncryptedBlob (ciphertext, Phase-2) or a
   * plaintext string (legacy). NEVER decrypted here (V6, no new crypto).
   */
  apiKey: string | EncryptedBlob | undefined;
  useCustomProxy: boolean;
  proxyUrl: string;
  /** Model ids from the disk detail (may be stale until a D-52 refresh). */
  models: string[];
  /** Registered ILLMProvider instance (D-51) — present after registerProvider. */
  provider?: ILLMProvider;
}

// ---------------------------------------------------------------------------
// zod validation at the storage boundary (T-3-16 / CLAUDE.md cross-boundary rule)
// ---------------------------------------------------------------------------

const httpUrlSchema = z
  .string()
  .refine((v) => /^https?:\/\//i.test(v), { message: 'endpoint override must be an http(s) URL' });

/** D-50: np_endpoint_overrides — per-provider endpoint overrides. */
const EndpointOverridesSchema = z.object({
  openai: httpUrlSchema.optional(),
  anthropic: httpUrlSchema.optional(),
  gemini: httpUrlSchema.optional(),
  ollama: httpUrlSchema.optional(),
  'openai-compat': httpUrlSchema.optional(),
});

/** EncryptedBlob fields (EncryptedStorage.ts:12-19) — ciphertext envelope. */
const apiKeyBlobSchema = z.object({
  salt: z.string(),
  iv: z.string(),
  ciphertext: z.string(),
});

/** Phase-2 disk detail (src/types/index.ts:103-112), permissively validated. */
const DiskProviderDetailSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  isConfigured: z.boolean().optional(),
  enabled: z.boolean().optional(),
  apiKey: z.union([z.string(), apiKeyBlobSchema]).optional(),
  useCustomProxy: z.boolean().optional(),
  proxyUrl: z.string().optional(),
  models: z
    .array(z.object({ id: z.string(), name: z.string().optional(), enabled: z.boolean().optional() }))
    .optional(),
});

/** Phase-2 disk shape (src/types/index.ts:114-137) — D-49 keeps it on disk.
 * `openAiKey`/`geminiKey` are EncryptedBlob objects after a real
 * `persistProviderConfigEncrypted` save (they pass through
 * `encryptProviderConfig` unchanged); accepting both forms keeps the whole
 * schema from failing when an operator has configured a provider. */
const DiskProviderConfigSchema = z.object({
  providers: z.record(z.string(), DiskProviderDetailSchema).optional(),
  openAiKey: z.union([z.string(), apiKeyBlobSchema]).optional(),
  geminiKey: z.union([z.string(), apiKeyBlobSchema]).optional(),
});

/** D-49: disk CustomProviderId → runtime ProviderId. 'claude' → 'anthropic' ONLY here. */
const DISK_TO_RUNTIME: Record<string, ProviderId | undefined> = {
  openai: 'openai',
  claude: 'anthropic',
  gemini: 'gemini',
  ollama: 'ollama',
};

/** Runtime ProviderId → disk CustomProviderId (inverse mapping for D-52 discovery). */
function diskIdFor(providerId: ProviderId): CustomProviderId | undefined {
  if (providerId === 'anthropic') return 'claude';
  if (providerId === 'openai-compat') return undefined; // operator-assigned, no discovery
  return providerId as CustomProviderId;
}

// ---------------------------------------------------------------------------
// Module state (single registry instance per surface — UI contexts only)
// ---------------------------------------------------------------------------

const normalized = new Map<ProviderId, NormalizedProvider>();
const registered = new Map<ProviderId, ILLMProvider>();
const modelCache = new Map<ProviderId, string[]>(); // D-52 session cache
const endpointOverrides = new Map<ProviderId, string>(); // D-50
let hydrated = false;
let compatRegistered = false;

// ---------------------------------------------------------------------------
// D-51: declarative registration at module load
// ---------------------------------------------------------------------------

/** Register an ILLMProvider (D-51). Called by the four plan-03-03 singletons
 * at module load; tests register fixtures. OpenAICompat (D-56) registers at
 * hydrate when the operator has assigned an endpoint. */
function registerProvider(provider: ILLMProvider): void {
  registered.set(provider.providerId, provider);
  const existing = normalized.get(provider.providerId);
  if (existing) {
    existing.provider = provider;
  } else {
    normalized.set(provider.providerId, {
      id: provider.providerId,
      name: provider.providerId,
      isConfigured: false,
      enabled: false,
      apiKey: undefined,
      useCustomProxy: false,
      proxyUrl: '',
      models: [],
      provider,
    });
  }
}

// D-51: the five provider modules register declaratively at module load. The
// 03-03 provider files predate the registry, so this import boundary is the
// registration point: importing the singletons triggers their module load
// and registers them here. OpenAICompat registers when an endpoint override
// exists (see hydrate — D-56 operator-assigned endpoint).
registerProvider(openaiProvider);
registerProvider(anthropicProvider);
registerProvider(geminiProvider);
registerProvider(ollamaProvider);

// ---------------------------------------------------------------------------
// Hydration (D-49/D-50) — read-only, once at boot before UI renders
// ---------------------------------------------------------------------------

/**
 * Read `np_providers` (same read path as useExtensionStore:774-775 —
 * chromeStorageAdapter.getItem; NO new crypto, V6) + `np_endpoint_overrides`
 * and normalize into the in-memory registry. READ-ONLY: never writes
 * chrome.storage — the disk shape stays byte-identical (D-49).
 */
async function hydrate(): Promise<void> {
  // D-50: endpoint overrides merge first, validated at read (T-3-16).
  try {
    const raw = await chromeStorageAdapter.getItem('np_endpoint_overrides');
    if (raw) {
      const parsed = EndpointOverridesSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        endpointOverrides.clear();
        for (const [id, url] of Object.entries(parsed.data)) {
          if (url !== undefined) endpointOverrides.set(id as ProviderId, url);
        }
      } else {
        debugLog('ENDPOINT_OVERRIDES_INVALID', 'np_endpoint_overrides failed zod validation', {
          issueCount: parsed.error.issues.length,
        });
      }
    }
  } catch (err) {
    debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
  }

  // D-49: normalize the Phase-2 object shape in memory. Encrypted apiKeys
  // pass through opaque — no decryption here.
  try {
    const raw = await chromeStorageAdapter.getItem('np_providers');
    if (raw) {
      const parsed = DiskProviderConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        for (const [diskId, detail] of Object.entries(parsed.data.providers ?? {})) {
          const runtimeId = DISK_TO_RUNTIME[diskId];
          if (runtimeId === undefined) continue;
          normalized.set(runtimeId, {
            id: runtimeId,
            name: detail.name ?? runtimeId,
            isConfigured: detail.isConfigured ?? false,
            enabled: detail.enabled ?? false,
            apiKey: detail.apiKey as string | EncryptedBlob | undefined,
            useCustomProxy: detail.useCustomProxy ?? false,
            proxyUrl: detail.proxyUrl ?? '',
            models: (detail.models ?? []).map((m) => m.id),
            provider: registered.get(runtimeId),
          });
          // CR-02: seed the D-52 session cache from the disk model list —
          // stale-but-present beats never-populated, so resolveTier can
          // validate persisted assignments before the first live discovery
          // completes (Options discovery refreshes the cache via refreshModels).
          modelCache.set(runtimeId, (detail.models ?? []).map((m) => m.id));
        }
      } else {
        debugLog('PROVIDERS_INVALID', 'np_providers failed zod validation');
      }
    }
  } catch (err) {
    debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
  }

  // D-56: OpenAICompat registers only when the operator assigned an endpoint
  // (it has no §10.6 default and no tier default — never a canonical route).
  const compatUrl = endpointOverrides.get('openai-compat');
  if (compatUrl !== undefined && !compatRegistered) {
    registerProvider(new OpenAICompatProvider({ baseUrl: compatUrl }));
    compatRegistered = true;
  }

  hydrated = true;
  debugLog('PROVIDER_REGISTRY_HYDRATED', 'registry hydrated from np_providers + np_endpoint_overrides');
}

// ---------------------------------------------------------------------------
// Sync read surface (D-51) — no async in reads; hydrate() before use
// ---------------------------------------------------------------------------

/** Enabled providers with a registered instance, in registry order. */
function getEnabled(): ILLMProvider[] {
  return Array.from(normalized.values())
    .filter((n) => n.enabled && n.provider !== undefined)
    .map((n) => n.provider as ILLMProvider);
}

/**
 * In-memory mirror of the operator's enable toggle (Options > General). The
 * registry's `normalized.enabled` flag is hydrated from `np_providers` at boot,
 * but the Options Switch handler writes to the Zustand store (`np_store`),
 * not `np_providers` — so a re-hydration after a toggle would still return the
 * pre-toggle value. `setEnabled` patches the in-memory entry directly so the
 * discovery loop and any other sync `getEnabled` reader see the operator's
 * intent on the same tick. No-op when the provider has not been registered yet
 * (the four module-load singletons are always registered, so this only fails
 * for an OpenAICompat assignment with no prior hydrate).
 */
function setEnabled(providerId: ProviderId, enabled: boolean): void {
  const entry = normalized.get(providerId);
  if (entry === undefined) return;
  entry.enabled = enabled;
}

function getById(id: ProviderId): NormalizedProvider | undefined {
  return normalized.get(id);
}

function getAll(): NormalizedProvider[] {
  return Array.from(normalized.values());
}

/** §10.6 default merged with np_endpoint_overrides (D-50). openai-compat has
 * no canonical default — operator-assigned only (D-56). */
function getEndpointFor(providerId: ProviderId): string | undefined {
  const override = endpointOverrides.get(providerId);
  if (override !== undefined) return override;
  if (providerId === 'openai-compat') return undefined;
  return ENDPOINTS[providerId];
}

// ---------------------------------------------------------------------------
// D-52: live model discovery + session cache
// ---------------------------------------------------------------------------

/** CR-01: per-route construction config — a fresh instance per routed call. */
export interface RouteProviderConfig {
  /**
   * Resolved model (D-54) — the instance carries it because the D-47
   * `requestJson(prompt, jsonSchema, signal)` interface has no model slot.
   */
  model: string;
  /**
   * Decrypted operator key. V6: the registry never decrypts — the caller
   * (chat hook) supplies the plaintext hydrated by useExtensionStore.
   */
  apiKey?: string;
}

/** The four module-load singletons are config-empty by design (CR-01). */
function isModuleSingleton(provider: ILLMProvider): boolean {
  return (
    provider === openaiProvider ||
    provider === anthropicProvider ||
    provider === geminiProvider ||
    provider === ollamaProvider
  );
}

/**
 * Construct the per-route provider instance (CR-01): merged endpoint (D-50)
 * + decrypted key + resolved model. The module-load singletons carry no
 * apiKey/model, so every runtime request flows through a built-for-route
 * instance — auth headers and requestJson's model are present. A
 * caller-registered instance (test fixture, D-48) owns its wire behavior and
 * is routed through as-is. OpenAICompat is always rebuilt with the assigned
 * endpoint + key + model (its hydrate-time instance has no key/model).
 */
function buildForRoute(providerId: ProviderId, config: RouteProviderConfig): ILLMProvider | undefined {
  if (providerId !== 'openai-compat') {
    const existing = registered.get(providerId);
    if (existing !== undefined && !isModuleSingleton(existing)) return existing;
  }
  const endpoint = getEndpointFor(providerId);
  if (endpoint === undefined) return undefined; // openai-compat without assignment (D-56)
  switch (providerId) {
    case 'openai':
      return new OpenAIProvider({ baseUrl: endpoint, model: config.model, apiKey: config.apiKey });
    case 'anthropic':
      return new AnthropicProvider({ baseUrl: endpoint, model: config.model, apiKey: config.apiKey });
    case 'gemini':
      return new GeminiProvider({ baseUrl: endpoint, model: config.model, apiKey: config.apiKey });
    case 'ollama':
      return new OllamaProvider({ baseUrl: endpoint, model: config.model });
    case 'openai-compat':
      return new OpenAICompatProvider({ baseUrl: endpoint, model: config.model, apiKey: config.apiKey });
    default:
      return undefined;
  }
}

/**
 * Live model discovery for Options refresh + connection test. Reuses the
 * `fetchModelsOrError` semantics from src/services/aiProvider.ts, passing the
 * MERGED endpoint (D-50 overrides apply) as proxyUrl. On success the fetched
 * list is cached in memory for the session; on failure the previous cache is
 * kept (stale beats empty for TierResolver validation stability).
 */
async function refreshModels(providerId: ProviderId, apiKey?: string): Promise<string[]> {
  const endpoint = getEndpointFor(providerId);
  if (endpoint === undefined) return []; // openai-compat without assignment
  const diskId = diskIdFor(providerId);
  if (diskId === undefined) return []; // openai-compat: operator-assigned list, no discovery

  // Ollama's /api/tags lives at the ROOT (not under /v1) — the legacy
  // fetchModelsOrError ollama branch appends /api/tags to the passed URL,
  // so pass the root for ollama discovery.
  const discoveryUrl = providerId === 'ollama' ? endpoint.replace(/\/v1\/?$/, '') : endpoint;

  const result = await fetchModelsOrError(diskId, apiKey, discoveryUrl);
  if (!result.ok) {
    debugLog('MODEL_DISCOVERY_FAILED', `${providerId} model discovery failed`, {
      providerId,
    });
    return modelCache.get(providerId) ?? [];
  }
  const ids = result.models.map((m) => m.id);
  modelCache.set(providerId, ids);
  debugLog('MODEL_DISCOVERY_OK', `${providerId} discovered ${ids.length} models`, {
    providerId,
    count: ids.length,
  });
  return ids;
}

/** Session-cache read (D-52). Undefined when discovery has not run yet. */
function getCachedModels(providerId: ProviderId): string[] | undefined {
  return modelCache.get(providerId);
}

// ---------------------------------------------------------------------------
// Test seams — exported only for unit tests. `__test__` prefix matches the
// chromeStorageAdapter convention. Production code must NOT use these.
// ---------------------------------------------------------------------------

export const __test__ = {
  reset(): void {
    normalized.clear();
    registered.clear();
    modelCache.clear();
    endpointOverrides.clear();
    hydrated = false;
    compatRegistered = false;
    registerProvider(openaiProvider);
    registerProvider(anthropicProvider);
    registerProvider(geminiProvider);
    registerProvider(ollamaProvider);
  },
  seedCachedModels(providerId: ProviderId, models: string[]): void {
    modelCache.set(providerId, models);
  },
  seedEndpointOverride(providerId: ProviderId, url: string): void {
    endpointOverrides.set(providerId, url);
  },
};

/** Object form for callers that prefer a namespace (boot wiring, TierResolver). */
export const ProviderRegistry = {
  hydrate,
  registerProvider,
  getEnabled,
  getById,
  getAll,
  getEndpointFor,
  buildForRoute,
  refreshModels,
  getCachedModels,
  setEnabled,
  isHydrated: (): boolean => hydrated,
};

export {
  hydrate,
  registerProvider,
  getEnabled,
  getById,
  getAll,
  getEndpointFor,
  buildForRoute,
  refreshModels,
  getCachedModels,
  setEnabled,
};