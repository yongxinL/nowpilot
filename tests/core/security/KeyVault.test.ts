import { describe, it, expect, beforeEach } from 'vitest';
import {
  CREDENTIAL_KEY_PREFIX,
  createKeyVault,
  type InstallSecretReadResult,
  type KeyVaultDeps,
  type StorageAreaLike,
} from '../../../src/core/security/KeyVault';
import {
  decryptCredential,
  parseCredentialEnvelope,
  type CredentialEnvelopeV1,
} from '../../../src/core/security/EncryptedStorage';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';
import type { ProviderId } from '../../../src/types';

/**
 * KeyVault suite (plan `02-03`, Task 2 — D2-03/D2-04/D2-06).
 *
 * The credential is the repository's synthetic sentinel — never a real key.
 * Every failure path asserts the sentinel's absence from the persisted record,
 * the storage map and the `debugLog` ring buffer.
 */

const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';
const SECOND_SECRET = 'sk-second-NEW-VALUE-999';
const INSTALL_SECRET = 'aW5zdGFsbC1zZWNyZXQtbWF0ZXJpYWwtMDAwMDAwMDA=';
const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
const OTHER_EXTENSION_ID = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
const OPENAI_KEY = `${CREDENTIAL_KEY_PREFIX}openai`;

beforeEach(() => {
  clearLogs();
});

/** A Map-backed storage area with the exact `chrome.storage.local` surface. */
function createFakeStorageArea(): { area: StorageAreaLike; map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    area: {
      get: async (keys?: string | string[] | null): Promise<Record<string, unknown>> => {
        if (keys === undefined || keys === null) return Object.fromEntries(map);
        const list = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of list) result[key] = map.get(key) ?? null;
        return result;
      },
      set: async (items: Record<string, unknown>): Promise<void> => {
        for (const [key, value] of Object.entries(items)) map.set(key, value);
      },
      remove: async (keys: string | string[]): Promise<void> => {
        for (const key of Array.isArray(keys) ? keys : [keys]) map.delete(key);
      },
    },
  };
}

function createVault(overrides: Partial<KeyVaultDeps> = {}) {
  return createKeyVault({
    extensionId: EXTENSION_ID,
    readInstallSecret: async (): Promise<InstallSecretReadResult> => ({
      ok: true,
      value: INSTALL_SECRET,
    }),
    ...overrides,
  });
}

/** The persisted envelope, parsed — fails the case when the record is not one. */
function storedEnvelope(map: Map<string, unknown>, key = OPENAI_KEY): CredentialEnvelopeV1 {
  const parsed = parseCredentialEnvelope(map.get(key));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error('stored envelope did not parse');
  return parsed.envelope;
}

/** Everything the storage area holds, serialised for a sentinel scan. */
function serialisedStorage(map: Map<string, unknown>): string {
  return JSON.stringify([...map.entries()]);
}

describe('KeyVault — round trip and persistence shape', () => {
  it('round-trips a credential through the injected storage area and persists only the envelope', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    expect(await vault.isConfigured('openai')).toBe(false);
    expect(await vault.store('openai', SENTINEL)).toEqual({ ok: true });
    expect(await vault.isConfigured('openai')).toBe(true);

    expect(await vault.retrieve('openai')).toEqual({ ok: true, credential: SENTINEL });

    expect([...map.keys()]).toEqual([OPENAI_KEY]);
    const envelope = storedEnvelope(map);
    expect(envelope.v).toBe(1);
    expect(envelope.providerId).toBe('openai');
    expect(serialisedStorage(map)).not.toContain(SENTINEL);
  });

  it('draws fresh key material for a second provider, so identical plaintext differs', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    await vault.store('openai', SENTINEL);
    await vault.store('gemini', SENTINEL);

    const first = storedEnvelope(map);
    const second = storedEnvelope(map, `${CREDENTIAL_KEY_PREFIX}gemini`);
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('inspectEnvelopeVersion reports presence and version only — never any plaintext field', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    expect(await vault.inspectEnvelopeVersion('openai')).toEqual({
      ok: true,
      value: { present: false, version: null, providerId: 'openai' },
    });

    await vault.store('openai', SENTINEL);

    const inspected = await vault.inspectEnvelopeVersion('openai');
    expect(inspected).toEqual({
      ok: true,
      value: { present: true, version: 1, providerId: 'openai' },
    });
    expect(Object.keys(inspected)).toEqual(['ok', 'value']);
    expect(JSON.stringify(inspected)).not.toContain(SENTINEL);
    expect(JSON.stringify(inspected)).not.toContain(storedEnvelope(map).ciphertext);
  });
});

describe('KeyVault — store, replace and delete semantics (D2-06)', () => {
  it('store is create-only: an existing credential returns a typed conflict and is unchanged', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    await vault.store('openai', SENTINEL);
    const before = storedEnvelope(map);

    expect(await vault.store('openai', SECOND_SECRET)).toEqual({
      ok: false,
      code: 'KEY_VAULT_ALREADY_CONFIGURED',
    });
    expect(storedEnvelope(map)).toEqual(before);
    expect(map.size).toBe(1);
    expect(await vault.retrieve('openai')).toEqual({ ok: true, credential: SENTINEL });
  });

  it('replace requires an existing credential and never doubles as a first store', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    expect(await vault.replace('gemini', SENTINEL)).toEqual({
      ok: false,
      code: 'KEY_VAULT_NOT_CONFIGURED',
    });
    expect(map.size).toBe(0);
  });

  it('replace re-mints salt and IV and makes the superseded value unrecoverable', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    await vault.store('openai', SENTINEL);
    const before = storedEnvelope(map);

    expect(await vault.replace('openai', SECOND_SECRET)).toEqual({ ok: true });
    const after = storedEnvelope(map);

    expect(after.salt).not.toBe(before.salt);
    expect(after.iv).not.toBe(before.iv);
    expect(after.ciphertext).not.toBe(before.ciphertext);
    // The superseded ciphertext is no longer stored anywhere.
    expect(serialisedStorage(map)).not.toContain(before.ciphertext);
    expect(serialisedStorage(map)).not.toContain(SENTINEL);
    // The vault returns only the new value.
    expect(await vault.retrieve('openai')).toEqual({ ok: true, credential: SECOND_SECRET });
    // Resurrecting the old ciphertext into the new envelope fails closed.
    const resurrected = await decryptCredential({
      envelope: { ...after, ciphertext: before.ciphertext },
      installSecret: INSTALL_SECRET,
      extensionId: EXTENSION_ID,
    });
    expect(resurrected).toEqual({ ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' });
  });

  it('delete is idempotent — a second delete succeeds too', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    await vault.store('openai', SENTINEL);
    expect(await vault.delete('openai')).toEqual({ ok: true });
    expect(map.has(OPENAI_KEY)).toBe(false);
    expect(await vault.isConfigured('openai')).toBe(false);
    expect(await vault.delete('openai')).toEqual({ ok: true });
    expect(map.size).toBe(0);
  });
});

describe('KeyVault — fail-closed paths', () => {
  it('reports an absent provider as not-configured rather than as an error', async () => {
    const { area } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    expect(await vault.isConfigured('gemini')).toBe(false);
    expect(await vault.retrieve('gemini')).toEqual({ ok: false, code: 'KEY_VAULT_NOT_CONFIGURED' });
    expect(await vault.inspectEnvelopeVersion('gemini')).toEqual({
      ok: true,
      value: { present: false, version: null, providerId: 'gemini' },
    });
  });

  it('fails a malformed stored envelope closed without throwing', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    for (const malformed of [{ junk: true }, 'not-an-envelope', 42]) {
      map.set(OPENAI_KEY, malformed);
      const result = await vault.retrieve('openai');
      expect(result).toEqual({ ok: false, code: 'CREDENTIAL_DECRYPT_FAILED' });
      expect(JSON.stringify(result)).not.toContain(SENTINEL);
      expect(await vault.inspectEnvelopeVersion('openai')).toEqual({
        ok: true,
        value: { present: true, version: null, providerId: 'openai' },
      });
    }

    // A stored `null` is indistinguishable from absence in `chrome.storage`,
    // so it reads as not-configured rather than as a decrypt failure.
    map.set(OPENAI_KEY, null);
    expect(await vault.retrieve('openai')).toEqual({ ok: false, code: 'KEY_VAULT_NOT_CONFIGURED' });
  });

  it('fails a wrong-key decrypt closed (a different extension id)', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });
    await vault.store('openai', SENTINEL);

    const otherVault = createVault({ storage: area, extensionId: OTHER_EXTENSION_ID });
    expect(await otherVault.retrieve('openai')).toEqual({
      ok: false,
      code: 'CREDENTIAL_DECRYPT_FAILED',
    });
    // The stored value is untouched by the failed attempt.
    expect(serialisedStorage(map)).not.toContain(SENTINEL);
    expect(await vault.retrieve('openai')).toEqual({ ok: true, credential: SENTINEL });
  });

  it('fails closed and writes nothing when the install secret is unavailable', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({
      storage: area,
      readInstallSecret: async () => ({ ok: false, code: 'INSTALL_SECRET_UNAVAILABLE' }),
    });

    expect(await vault.store('openai', SENTINEL)).toEqual({
      ok: false,
      code: 'KEY_VAULT_SECRET_UNAVAILABLE',
    });
    expect(map.size).toBe(0);

    const throwingVault = createVault({
      storage: area,
      readInstallSecret: async () => {
        throw new Error('secret backend exploded');
      },
    });
    expect(await throwingVault.store('openai', SENTINEL)).toEqual({
      ok: false,
      code: 'KEY_VAULT_SECRET_UNAVAILABLE',
    });
    expect(map.size).toBe(0);
  });

  it('fails closed when the context cannot supply an extension id or a storage area', async () => {
    // No injected extensionId and no chrome.runtime.id in this environment:
    // the defaults are resolved per call and never fabricated at module scope.
    const vault = createKeyVault({
      readInstallSecret: async () => ({ ok: true, value: INSTALL_SECRET }),
    });

    expect(await vault.store('openai', SENTINEL)).toEqual({
      ok: false,
      code: 'KEY_VAULT_UNAVAILABLE',
    });
    expect(await vault.retrieve('openai')).toEqual({ ok: false, code: 'KEY_VAULT_UNAVAILABLE' });
    expect(await vault.isConfigured('openai')).toBe(false);

    // Presence, version inspection and removal need a storage area but no
    // derived key, so they still resolve — here against the test
    // environment's shared storage mock, where the key is absent.
    expect(await vault.inspectEnvelopeVersion('openai')).toEqual({
      ok: true,
      value: { present: false, version: null, providerId: 'openai' },
    });
    expect(await vault.delete('openai')).toEqual({ ok: true });
  });

  it('rejects a non-member provider id at every operation, without logging the rejected value', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });
    const impostor = 'claude' as unknown as ProviderId;

    expect(await vault.store(impostor, SENTINEL)).toEqual({
      ok: false,
      code: 'KEY_VAULT_INVALID_PROVIDER',
    });
    expect(await vault.replace(impostor, SENTINEL)).toEqual({
      ok: false,
      code: 'KEY_VAULT_INVALID_PROVIDER',
    });
    expect(await vault.retrieve(impostor)).toEqual({
      ok: false,
      code: 'KEY_VAULT_INVALID_PROVIDER',
    });
    expect(await vault.delete(impostor)).toEqual({
      ok: false,
      code: 'KEY_VAULT_INVALID_PROVIDER',
    });
    expect(await vault.inspectEnvelopeVersion(impostor)).toEqual({
      ok: false,
      code: 'KEY_VAULT_INVALID_PROVIDER',
    });
    expect(await vault.isConfigured(impostor)).toBe(false);

    expect(map.size).toBe(0);
    // The rejected value never reaches a log line.
    expect(JSON.stringify(getRecentLogs())).not.toContain('claude');
  });

  it('rejects an empty, whitespace-only or non-string credential and persists nothing', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    for (const bad of ['', '   ', 42, null, undefined, {}]) {
      expect(await vault.store('openai', bad as unknown as string)).toEqual({
        ok: false,
        code: 'KEY_VAULT_INVALID_CREDENTIAL',
      });
      expect(await vault.replace('openai', bad as unknown as string)).toEqual({
        ok: false,
        code: 'KEY_VAULT_INVALID_CREDENTIAL',
      });
    }
    expect(map.size).toBe(0);
  });

  it('maps storage read, write and delete failures to typed codes instead of throwing', async () => {
    const failing: StorageAreaLike = {
      get: async () => {
        throw new Error('read exploded');
      },
      set: async () => {
        throw new Error('write exploded');
      },
      remove: async () => {
        throw new Error('remove exploded');
      },
    };
    const vault = createVault({ storage: failing });

    expect(await vault.retrieve('openai')).toEqual({ ok: false, code: 'KEY_VAULT_READ_FAILED' });
    expect(await vault.delete('openai')).toEqual({ ok: false, code: 'KEY_VAULT_DELETE_FAILED' });
    expect(await vault.isConfigured('openai')).toBe(false);

    const { area, map } = createFakeStorageArea();
    const writeFailing = createVault({
      storage: { ...area, set: async () => { throw new Error('write exploded'); } },
    });
    expect(await writeFailing.store('openai', SENTINEL)).toEqual({
      ok: false,
      code: 'KEY_VAULT_WRITE_FAILED',
    });
    expect(map.size).toBe(0);
  });
});

describe('KeyVault — redaction discipline', () => {
  it('never writes the sentinel to the debugLog ring buffer on any path', async () => {
    const { area, map } = createFakeStorageArea();
    const vault = createVault({ storage: area });

    await vault.store('openai', SENTINEL);
    await vault.store('openai', SENTINEL); // conflict
    await vault.replace('gemini', SENTINEL); // not configured
    await vault.retrieve('gemini'); // not configured
    await vault.delete('openai');
    await vault.retrieve('openai'); // not configured after delete
    map.set(OPENAI_KEY, { junk: true });
    await vault.retrieve('openai'); // malformed envelope
    await vault.delete('openai');
    await vault.delete('openai'); // idempotent second delete

    const logs = getRecentLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((entry) => /^[A-Z][A-Z0-9_]+$/.test(entry.code))).toBe(true);
    const serialisedLogs = JSON.stringify(logs);
    expect(serialisedLogs).not.toContain(SENTINEL);
    expect(serialisedLogs).not.toContain(SENTINEL.slice(0, 10));
    expect(serialisedLogs).not.toContain(SENTINEL.slice(-6));
    expect(serialisedLogs).not.toContain(INSTALL_SECRET);
    expect(serialisedStorage(map)).not.toContain(SENTINEL);
  });
});
