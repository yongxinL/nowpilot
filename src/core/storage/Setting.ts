import { debugLog } from '../log/debugLog';
import { redactErrorContext } from '../security/redactSensitive';

/**
 * Setting — the serialised single-key write primitive, and the `np_install_secret`
 * lifecycle that is its real Phase 2 consumer (OQ-3, OQ-6, §13, §15.1).
 *
 * ## Why this module exists
 *
 * `src/core/storage/Setting.ts` is on the §18 Phase 2 Create list and §13
 * requires serialised settings writes, but a module with no consumer is the
 * placeholder D2-26's rule of thumb forbids. The consumer is real and named:
 * `KeyVault` takes `readInstallSecret` as an injected dependency, and 02-03
 * types that dependency as exactly this module's
 * `() => Promise<{ ok: true; value: string } | { ok: false; code }>`, so the
 * production wiring is `createKeyVault({ readInstallSecret })` — a direct
 * pass-through with no adapter module.
 *
 * ## The install secret
 *
 * §15.1/§15.2: `np_install_secret` holds **32 random bytes, base64-encoded**,
 * created once and read by every surface's vault. The lifecycle here is
 * **lazy create-on-first-use with read-back verification** (OQ-6), mirroring
 * the election's read-validate-write-read-back shape, so the vault works
 * identically in every extension context and in tests — no context has to have
 * seeded the key first.
 *
 * The protocol:
 *
 *   1. read the key; a present value is validated (canonical base64 decoding to
 *      exactly `INSTALL_SECRET_BYTES` bytes) and returned;
 *   2. absent ⇒ inside the per-key serialised section, **re-read** — a
 *      concurrent first use from the other surface may have created the secret
 *      between our first read and the section;
 *   3. still absent ⇒ generate 32 bytes with `crypto.getRandomValues`, write,
 *      **read back**, and report success only when the read-back is the value
 *      written. A different value is reported as a typed failure, never as a
 *      success and never overwritten.
 *
 * A malformed, wrong-length or non-string stored value **fails closed** with a
 * typed code and is never regenerated over — silently replacing a value the
 * vault may already have used would orphan every envelope encrypted under it.
 *
 * ## Discipline
 *
 * Nothing here logs the value, its length or any fragment of it: failures log a
 * `SCREAMING_SNAKE` code plus a reason from `redactErrorContext` (an error
 * **name** only), and the only context ever attached is the canonical key name.
 * The module writes exactly one storage key and no other.
 */

/** The one canonical key (§15.1). */
export const SETTING_INSTALL_SECRET_KEY = 'np_install_secret';

/** §15.2: the install secret is 32 random bytes. */
export const INSTALL_SECRET_BYTES = 32;

/**
 * Why an install-secret read could not produce a value.
 *
 * `SETTING_STORAGE_UNAVAILABLE` is the soft result for a context with no
 * `chrome.storage.local` (a non-extension context, or a test without the mock)
 * — this module never throws for it.
 */
export type SettingErrorCode =
  | 'SETTING_STORAGE_UNAVAILABLE'
  | 'SETTING_READ_FAILED'
  | 'SETTING_WRITE_FAILED'
  | 'SETTING_INSTALL_SECRET_INVALID'
  | 'SETTING_INSTALL_SECRET_UNVERIFIED';

/** The install-secret read result — the exact union `KeyVault` injects. */
export type SettingResult =
  | { ok: true; value: string }
  | { ok: false; code: SettingErrorCode };

/**
 * The minimal storage-area surface this module needs. `chrome.storage.local`
 * satisfies it structurally; a test passes a Map-backed fake.
 */
interface SettingStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/** Canonical base64 — the same rule the envelope codec applies to its fields. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Encode bytes for the stored value. Local by design: see the module note. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decode a stored value; `null` for anything that is not canonical base64. */
function base64ToBytes(value: string): Uint8Array | null {
  if (value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * The in-flight write chain, one entry per storage key.
 *
 * A second `writeSettingSerialized` call for the same key awaits the first and
 * then runs, so writes for a key are strictly ordered and never interleave
 * (last write wins by completion order). Different keys never queue behind each
 * other.
 */
const pendingChains = new Map<string, Promise<void>>();

/**
 * Serialise a write for one storage key.
 *
 * `then(write, write)` is deliberate: a failed earlier write must not cancel a
 * later one — the chain is an ordering primitive, not a circuit breaker. The
 * map holds a rejection-swallowed tail so a failed write never leaves an
 * unhandled rejection behind; the caller still receives the real outcome.
 */
export function writeSettingSerialized(key: string, write: () => Promise<void>): Promise<void> {
  const previous = pendingChains.get(key) ?? Promise.resolve();
  const next = previous.then(write, write);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );

  pendingChains.set(key, tail);
  void tail.then(() => {
    if (pendingChains.get(key) === tail) pendingChains.delete(key);
  });

  return next;
}

/** Resolved per call — never at module scope, so the module imports anywhere. */
function resolveStorageArea(): SettingStorageArea | null {
  const area = typeof chrome !== 'undefined' ? chrome?.storage?.local : undefined;
  return area ? (area as unknown as SettingStorageArea) : null;
}

type RawRead = { ok: true; value: unknown } | { ok: false; code: SettingErrorCode };

/**
 * Read the raw stored value. `value` is `null` when the key is absent; a read
 * that throws is a typed failure, never an empty string.
 */
async function readRaw(storage: SettingStorageArea): Promise<RawRead> {
  try {
    const stored = await storage.get(SETTING_INSTALL_SECRET_KEY);
    const value = stored?.[SETTING_INSTALL_SECRET_KEY];
    return { ok: true, value: value === undefined || value === null ? null : value };
  } catch (error) {
    debugLog('SETTING_READ_FAILED', 'Install secret read failed', {
      key: SETTING_INSTALL_SECRET_KEY,
      reason: redactErrorContext(error).reason,
    });
    return { ok: false, code: 'SETTING_READ_FAILED' };
  }
}

/** Validate a stored value as base64 of exactly `INSTALL_SECRET_BYTES` bytes. */
function validateStoredSecret(raw: unknown): SettingResult {
  if (typeof raw === 'string') {
    const bytes = base64ToBytes(raw);
    if (bytes !== null && bytes.length === INSTALL_SECRET_BYTES) {
      return { ok: true, value: raw };
    }
  }

  // Fail closed: a malformed or wrong-length value is never reported as usable
  // and is never regenerated over (it may already be the KDF input for stored
  // envelopes).
  debugLog('SETTING_INSTALL_SECRET_INVALID', 'Stored install secret is malformed', {
    key: SETTING_INSTALL_SECRET_KEY,
    reason: 'not-base64-of-install-secret-length',
  });
  return { ok: false, code: 'SETTING_INSTALL_SECRET_INVALID' };
}

/** 32 random bytes, base64 — the §15.1/§15.2 install secret. */
function generateInstallSecret(): string {
  const bytes = new Uint8Array(INSTALL_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

/**
 * Create the install secret if it is absent, or adopt the one that won a race.
 *
 * Runs inside `writeSettingSerialized`, so the re-read here is what turns a
 * concurrent first use into one durable value rather than two that disagree.
 */
async function createOrAdopt(storage: SettingStorageArea): Promise<SettingResult> {
  const current = await readRaw(storage);
  if (!current.ok) return current;
  if (current.value !== null) return validateStoredSecret(current.value);

  const candidate = generateInstallSecret();

  try {
    await storage.set({ [SETTING_INSTALL_SECRET_KEY]: candidate });
  } catch (error) {
    debugLog('SETTING_WRITE_FAILED', 'Install secret write failed', {
      key: SETTING_INSTALL_SECRET_KEY,
      reason: redactErrorContext(error).reason,
    });
    return { ok: false, code: 'SETTING_WRITE_FAILED' };
  }

  // Authoritative read-back: success only for the value actually stored.
  const readBack = await readRaw(storage);
  if (!readBack.ok) return readBack;
  if (readBack.value !== candidate) {
    debugLog(
      'SETTING_INSTALL_SECRET_UNVERIFIED',
      'Install secret read-back did not match the written value',
      { key: SETTING_INSTALL_SECRET_KEY },
    );
    return { ok: false, code: 'SETTING_INSTALL_SECRET_UNVERIFIED' };
  }

  debugLog('SETTING_INSTALL_SECRET_CREATED', 'Install secret created', {
    key: SETTING_INSTALL_SECRET_KEY,
  });
  return { ok: true, value: candidate };
}

/**
 * Read the install secret, creating it on first use.
 *
 * Total and throw-free: a missing storage area, a failed read, a failed write,
 * a malformed stored value and an unverified read-back all resolve to a typed
 * result. The value is returned only from the success arm.
 */
export async function readInstallSecret(): Promise<SettingResult> {
  const storage = resolveStorageArea();
  if (storage === null) {
    debugLog('SETTING_STORAGE_UNAVAILABLE', 'Install secret unavailable in this context', {
      key: SETTING_INSTALL_SECRET_KEY,
      reason: 'missing-storage-area',
    });
    return { ok: false, code: 'SETTING_STORAGE_UNAVAILABLE' };
  }

  const existing = await readRaw(storage);
  if (!existing.ok) return existing;
  if (existing.value !== null) return validateStoredSecret(existing.value);

  // Absent: the create is serialised per key. The outcome is captured rather
  // than returned from the callback so `writeSettingSerialized` keeps its
  // `() => Promise<void>` contract; the initialiser is a real failure so the
  // function can never return an unset result.
  let outcome: SettingResult = { ok: false, code: 'SETTING_WRITE_FAILED' };
  await writeSettingSerialized(SETTING_INSTALL_SECRET_KEY, async () => {
    outcome = await createOrAdopt(storage);
  });
  return outcome;
}

/**
 * Test seams — the `chromeStorageAdapter` `__test__` convention. Production
 * code must not use these: they exist so a suite can assert the write chain is
 * serialised without sleeping or driving fake timers.
 */
export const __test__ = {
  resetPendingWrites(): void {
    pendingChains.clear();
  },
  getPendingSize(): number {
    return pendingChains.size;
  },
};
