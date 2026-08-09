// src/core/storage/Setting.ts — the per-key permissioned typed wrapper over
// chrome.storage (STORAGE-02). D-09 fold note: the §18 create-list is
// authoritative — no separate storage-layer / session-store wrapper files are
// created; the layer concepts (per-key permission table, serialized writes,
// migrate-on-read) fold into THIS file and EncryptedStorage.ts.
//
// §13 line 1791: "Settings writes serialized — never two Setting<T> keys
// concurrently" — enforced mechanically by a module-level promise-chain mutex:
// every settingWrite chains on the previous write's settlement, so chrome
// storage set() calls never interleave (T-2-05-02).
//
// D-10 migrate-on-read: np_schema_version stamps the schema version; per-key
// sanitizers (the generalized T-1-13 inbound gate) normalize old KV shapes at
// surface init — additive/normalizing, never destructive (A-12).
//
// D-11 session tokens (np_jsessionid / np_sysparm_ck / np_token_ttl /
// np_active_stream / np_workspace_primary): DECLARED in the registry only with
// writeAllowed: false — no accessors exist; consumers arrive Phase 3/8
// (T-2-05-04). The generic read/write paths refuse declared-only keys.
//
// Encrypted-only contract (A-11): a key marked encrypted: true accepts ONLY an
// already-encrypted §15.2 vault envelope — Setting never encrypts itself
// (encryption is EncryptedStorage's job, 02-03) and never lets a raw secret
// reach chrome.storage (T-2-05-01).
//
// Every catch calls debugLog with a canonical STORE_* code (Golden Rule 9);
// the write path never throws.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { sanitizeStored as sanitizeAddonSettingsStored } from '@/core/registry/AddonSettingsStore';
import { sanitizeStored as sanitizeWorkspaceStored } from '@/core/workspace/WorkspaceStore';

export type StorageArea = 'local' | 'sync' | 'session';

export interface KeyPermission {
  area: StorageArea;
  /** encrypted: true → only a vault envelope may be written (A-11, T-2-05-01). */
  encrypted?: boolean;
  /** writeAllowed: false → declared-only key (D-11): no read/write access via Setting. */
  writeAllowed?: boolean;
}

/**
 * Per-key permission table (D-09). Maps every §15.1 key Phase 2 touches to its
 * area + policy. Cosmetic keys (np_theme/np_theme_pack/np_language) are sync
 * per §15.1 — D-15's quota-shadow machinery lands in 02-08.
 */
export const STORAGE_KEY_REGISTRY: Record<string, KeyPermission> = {
  // --- local (metadata, 10 MB quota) ---
  np_providers: { area: 'local', encrypted: true },
  np_install_secret: { area: 'local' },
  np_workspace: { area: 'local' },
  np_addon_settings: { area: 'local' },
  np_flags: { area: 'local' },
  np_persona: { area: 'local' },
  np_schema_version: { area: 'local' },
  np_debug_mode: { area: 'local' },
  // --- sync (cosmetic keys, ≤ 8 KB per key — §15.1) ---
  np_theme: { area: 'sync' },
  np_theme_pack: { area: 'sync' },
  np_language: { area: 'sync' },
  // --- session (cleared on browser close) — DECLARED ONLY, no accessors (D-11) ---
  np_jsessionid: { area: 'session', writeAllowed: false },
  np_sysparm_ck: { area: 'session', writeAllowed: false },
  np_token_ttl: { area: 'session', writeAllowed: false },
  np_active_stream: { area: 'session', writeAllowed: false },
  np_workspace_primary: { area: 'session', writeAllowed: false },
};

/** §15.2 vault envelope shape (salt + iv + ciphertext — EncryptedStorage). */
function isVaultEnvelopeShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return 'salt' in v && 'iv' in v && 'ciphertext' in v;
}

function areaApi(area: StorageArea): chrome.storage.StorageArea {
  switch (area) {
    case 'sync':
      return chrome.storage.sync;
    case 'session':
      return chrome.storage.session;
    default:
      return chrome.storage.local;
  }
}

// §13 promise-chain mutex — every write is appended to the previous write's
// settlement. Refusals and failures resolve (never reject) so the queue never
// wedges and the write path never throws (Golden Rule 9).
let writeChain: Promise<void> = Promise.resolve();

/**
 * Serialized, permission-checked write (D-09 / §13 line 1791). Refuses: unknown
 * keys, declared-only keys (writeAllowed: false), and raw values to
 * encrypted-only keys. Never throws — refusals resolve after a STORE_WRITE log.
 */
export function settingWrite<T>(key: string, value: T): Promise<void> {
  const run = writeChain.then(async () => {
    const permission = STORAGE_KEY_REGISTRY[key];
    if (permission === undefined || permission.writeAllowed === false) {
      debugLog(ERROR_CODES.STORE_WRITE, 'refused write to disallowed key', {
        module: 'Setting',
        extra: { key },
      });
      return;
    }
    if (permission.encrypted === true && !isVaultEnvelopeShape(value)) {
      // T-2-05-01: a secret can never bypass encryption through Setting.
      debugLog(ERROR_CODES.STORE_WRITE, 'refused raw write to encrypted-only key', {
        module: 'Setting',
        extra: { key },
      });
      return;
    }
    try {
      await areaApi(permission.area).set({ [key]: value });
    } catch (err) {
      debugLog(ERROR_CODES.STORE_WRITE, 'failed to write setting', {
        error: err instanceof Error ? err : undefined,
        module: 'Setting',
        extra: { key },
      });
    }
  });
  // Chain on the run itself (not its catch) so a refusal still serializes; the
  // catch keeps the queue alive if an unexpected rejection ever escapes.
  writeChain = run.catch(() => undefined);
  return run;
}

/**
 * Permission-checked read (D-09 / T-1-13). Unknown or declared-only keys return
 * `fallback`; stored values are never merged raw — the caller's sanitizer
 * normalizes them first, and `null` from the sanitizer means "use fallback".
 */
export async function settingRead<T>(
  key: string,
  sanitize: (v: unknown) => T | null,
  fallback: T,
): Promise<T> {
  const permission = STORAGE_KEY_REGISTRY[key];
  if (permission === undefined || permission.writeAllowed === false) {
    debugLog(ERROR_CODES.STORE_READ, 'refused read of disallowed key', {
      module: 'Setting',
      extra: { key },
    });
    return fallback;
  }
  try {
    const stored = await areaApi(permission.area).get(key);
    const raw = stored[key];
    if (raw === undefined) return fallback;
    const sanitized = sanitize(raw);
    return sanitized === null ? fallback : sanitized;
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to read setting', {
      error: err instanceof Error ? err : undefined,
      module: 'Setting',
    });
    return fallback;
  }
}

/** chrome.storage.local key holding the KV schema version (D-10). */
export const NP_SCHEMA_VERSION_KEY = 'np_schema_version';
/** Current chrome.storage.local schema version — bump on breaking KV shape changes. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Per-key migrate-on-read sanitizers (D-10) — the generalized T-1-13 inbound
 * gate, registered at surface init (entrypoints, 02-11 wiring). Each sanitizer
 * normalizes the stored value to the CURRENT shape; a value that already
 * matches is written back unchanged (no-op). Malformed values pass through
 * untouched — migration is additive/normalizing, never destructive (A-12).
 */
export const DEFAULT_MIGRATE_SANITIZERS: Record<string, (v: unknown) => unknown> = {
  // WorkspaceStore.sanitizeStored — drops obsolete fields, validates active ones.
  np_workspace: (v) => sanitizeWorkspaceStored(v) ?? v,
  // AddonSettingsStore's shape guard — validates the Record<addonId, Record> shape.
  np_addon_settings: (v) => sanitizeAddonSettingsStored(v),
  // np_providers stores the §15.2 vault envelope (A-11). ProviderConfig's shape
  // lands with the provider layer (Phase 3) — until then the guard is a light
  // envelope check that passes values through unchanged (never destructive).
  np_providers: (v) => (isVaultEnvelopeShape(v) ? v : v),
};

/**
 * Migrate-on-read (D-10): read np_schema_version, run each registered per-key
 * sanitizer over the stored value, write normalized values back if any changed,
 * then stamp np_schema_version = CURRENT_SCHEMA_VERSION. A fresh install (no
 * schema key) is a no-op that sets the version. Never throws.
 */
export async function runMigrateOnRead(
  sanitizers: Record<string, (v: unknown) => unknown>,
): Promise<void> {
  try {
    const keys = Object.keys(sanitizers);
    const stored = await chrome.storage.local.get([...keys, NP_SCHEMA_VERSION_KEY]);
    const writeBack: Record<string, unknown> = {};
    for (const key of keys) {
      const raw = stored[key];
      if (raw === undefined) continue; // absent key — nothing to migrate
      const normalized = sanitizers[key](raw);
      if (!isDeepEqual(normalized, raw)) writeBack[key] = normalized;
    }
    if (Object.keys(writeBack).length > 0) {
      await chrome.storage.local.set(writeBack);
    }
    if (stored[NP_SCHEMA_VERSION_KEY] !== CURRENT_SCHEMA_VERSION) {
      await chrome.storage.local.set({ [NP_SCHEMA_VERSION_KEY]: CURRENT_SCHEMA_VERSION });
    }
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'migrate-on-read failed', {
      error: err instanceof Error ? err : undefined,
      module: 'Setting',
    });
  }
}

/** Recursive deep equality for JSON-ish stored values (deterministic write-back). */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (k) =>
      k in (b as Record<string, unknown>) &&
      isDeepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
