import { debugLog } from '../log/debugLog';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';

const INSTALL_SECRET_KEY = 'np_install_secret';
const SALT_BYTES = 16;
const SECRET_BYTES = 32;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BITS = 256;

// Test seam: lets unit tests inject deterministic extension ids (e.g., the
// plan's RESEARCH A1 fallback for non-extension contexts) and a custom
// install-secret reader for tests that don't use chromeStorageAdapter.
// Production code paths MUST NOT touch this seam.
let extensionIdOverride: string | null = null;
let installSecretReaderOverride: (() => Promise<Uint8Array | null>) | null = null;

/**
 * Returns the extensionId used as input to the PBKDF2 derivation per
 * spec §15.2. Stable across browser updates per Chrome's documented
 * `chrome.runtime.id` behavior (RESEARCH A1). NEVER
 * `navigator.userAgent` — userAgent changes on browser update and
 * would invalidate all persisted ciphertext (RESEARCH §don't hand-roll).
 *
 * In non-extension contexts (test harness, background SW during dev
 * tooling) `chrome.runtime.id` is undefined; we fall back to a stable
 * sentinel so derivation succeeds deterministically. The sentinel is
 * used for all callers, but a future release can swap it out via the
 * `__test__` seam — it is NOT random per call.
 */
export function getExtensionId(): string {
  if (extensionIdOverride !== null) return extensionIdOverride;
  const fromChrome = (globalThis as any)?.chrome?.runtime?.id;
  if (typeof fromChrome === 'string' && fromChrome.length > 0) {
    return fromChrome;
  }
  return 'nowpilot-test-extension-id';
}

/**
 * Spec §15.2: ensures `np_install_secret` (32 random bytes, generated
 * ONCE per install) is present in chrome.storage.local. Returns the
 * persisted secret on every call. Never regenerates — D-29 one-way:
 * the secret is the encryption root; changing it invalidates all
 * persisted ciphertext (documented, accepted trade-off).
 */
export async function ensureInstallSecret(): Promise<Uint8Array> {
  const existing = installSecretReaderOverride
    ? await installSecretReaderOverride()
    : await readInstallSecretFromStorage();
  if (existing && existing.length === SECRET_BYTES) {
    return existing;
  }
  const fresh = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  try {
    // chromeStorageAdapter is debounced (300ms); for an install-secret
    // we want immediate durability. Use removeItem-style direct write:
    // chrome.storage.local.set avoids the debounce here.
    const hasLocal = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
    if (hasLocal) {
      // base64-encode the bytes for JSON-safe persistence.
      const encoded = bytesToBase64(fresh);
      await chrome.storage.local.set({ [INSTALL_SECRET_KEY]: encoded });
      return fresh;
    }
    localStorage.setItem(INSTALL_SECRET_KEY, bytesToBase64(fresh));
    return fresh;
  } catch (err: unknown) {
    debugLog('STORAGE_READ_FAILED', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * PBKDF2(installSecret || extensionId, salt, 100000, SHA-256) →
 * AES-GCM-256 (Research line 488-512 + spec §15.2 verbatim).
 *
 * The concatenation input is the deterministic encoding:
 * base64(installSecret) + ':' + extensionId  — locked at planning
 * time per 02-RESEARCH.md note on the §15.2 byte-string scheme.
 * Each implementation must pick ONE encoding and document it; this
 * is the chosen contract (PATTERNS EncryptedStorage + KeyVault).
 */
export async function deriveKey(
  installSecret: Uint8Array,
  extensionId: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const installB64 = bytesToBase64(installSecret);
  const material = new TextEncoder().encode(`${installB64}:${extensionId}`);
  const baseKey = await crypto.subtle.importKey('raw', material, { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Test seam: see `__test__` export below. Production code MUST NOT call this. */
export const __test__ = {
  setExtensionId(value: string | null): void {
    extensionIdOverride = value;
  },
  setInstallSecretReader(reader: (() => Promise<Uint8Array | null>) | null): void {
    installSecretReaderOverride = reader;
  },
  reset(): void {
    extensionIdOverride = null;
    installSecretReaderOverride = null;
  },
};

// --- Internal helpers ---

async function readInstallSecretFromStorage(): Promise<Uint8Array | null> {
  const hasLocal = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
  if (hasLocal) {
    const raw = await chrome.storage.local.get(INSTALL_SECRET_KEY);
    const value = raw[INSTALL_SECRET_KEY];
    if (typeof value === 'string' && value.length > 0) {
      return base64ToBytes(value);
    }
    return null;
  }
  const value = localStorage.getItem(INSTALL_SECRET_KEY);
  if (value) return base64ToBytes(value);
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa !== 'undefined') return btoa(binary);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Uint8Array((globalThis as any).Buffer.from(b64, 'base64'));
}
