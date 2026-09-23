import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  INSTALL_SECRET_BYTES,
  SETTING_INSTALL_SECRET_KEY,
  __test__,
  readInstallSecret,
  writeSettingSerialized,
  type SettingResult,
} from '../../../src/core/storage/Setting';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';
import { createKeyVault, type StorageAreaLike } from '../../../src/core/security/KeyVault';

/**
 * The `np_install_secret` lifecycle (plan `02-04`, Task 2 — OQ-3 / OQ-6, §15.1).
 *
 * Four properties are pinned:
 *   1. a fresh install creates exactly one key holding base64 that decodes to
 *      exactly 32 bytes, and a second read returns that value without
 *      regenerating it;
 *   2. concurrent first use from two surfaces resolves to **one** durable value
 *      — the write chain is serialised per key and the create re-reads inside
 *      the serialised section (T-02-21);
 *   3. a malformed, wrong-length or non-string stored value fails closed with a
 *      typed code and is never overwritten (T-02-22);
 *   4. no value, fragment or derived form of the secret reaches the log ring
 *      buffer, and no code path writes a second storage key.
 *
 * The suite drives the write chain through the `__test__` seams — no sleeps, no
 * fake timers.
 */

/** The chrome.storage.local mock's backing map (see `tests/setup.ts`). */
const storageMap = (): Map<string, unknown> =>
  (globalThis as unknown as { __chromeStorageMap: Map<string, unknown> }).__chromeStorageMap;

const storageLocal = (): typeof chrome.storage.local => chrome.storage.local;

/** The raw stored value for the install-secret key. */
const storedValue = (): unknown => storageMap().get(SETTING_INSTALL_SECRET_KEY);

/** How many `set` calls carried the install-secret key. */
function installSecretWrites(): number {
  const spy = vi.mocked(chrome.storage.local.set);
  return spy.mock.calls.filter(
    ([items]) => SETTING_INSTALL_SECRET_KEY in (items as Record<string, unknown>),
  ).length;
}

/** Microtask flush — deterministic, no timers. */
async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

/** A local encoder/decoder so the assertions never reuse the module's own. */
function encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

beforeEach(() => {
  storageMap().clear();
  clearLogs();
  __test__.resetPendingWrites();
  vi.clearAllMocks();
});

afterEach(() => {
  __test__.resetPendingWrites();
  vi.restoreAllMocks();
});

describe('Setting — the canonical install-secret constants', () => {
  it('names the §15.1 key and the §15.2 length', () => {
    expect(SETTING_INSTALL_SECRET_KEY).toBe('np_install_secret');
    expect(INSTALL_SECRET_BYTES).toBe(32);
  });
});

describe('Setting — lazy create-on-first-use', () => {
  it('creates exactly one key holding base64 that decodes to 32 bytes', async () => {
    const result = await readInstallSecret();

    expect(result.ok).toBe(true);
    const value = (result as { ok: true; value: string }).value;

    // Exactly one key — no second key, no marker key.
    expect(storageMap().size).toBe(1);
    expect([...storageMap().keys()]).toEqual([SETTING_INSTALL_SECRET_KEY]);

    expect(typeof storedValue()).toBe('string');
    expect(storedValue()).toBe(value);

    const bytes = decode(value);
    expect(bytes.length).toBe(INSTALL_SECRET_BYTES);
    // 32 bytes is 44 canonical base64 characters.
    expect(value).toHaveLength(44);
    expect(installSecretWrites()).toBe(1);
  });

  it('returns the same value on a second read without regenerating', async () => {
    const first = await readInstallSecret();
    const second = await readInstallSecret();

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(storedValue()).toBe((first as { ok: true; value: string }).value);
    expect(installSecretWrites()).toBe(1);
  });

  it('creates a different value per fresh store (it is random, not derived)', async () => {
    const first = await readInstallSecret();
    const firstValue = (first as { ok: true; value: string }).value;

    storageMap().clear();
    clearLogs();
    __test__.resetPendingWrites();

    const second = await readInstallSecret();
    expect((second as { ok: true; value: string }).value).not.toBe(firstValue);
  });
});

describe('Setting — concurrent first use resolves to one durable value (T-02-21)', () => {
  it('two concurrent calls agree on the stored value and write exactly once', async () => {
    const [a, b] = await Promise.all([readInstallSecret(), readInstallSecret()]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b).toEqual(a);
    expect(storedValue()).toBe((a as { ok: true; value: string }).value);
    expect(storageMap().size).toBe(1);
    // The re-read inside the serialised section is what makes this one write:
    // without it, both callers would have generated and written a value.
    expect(installSecretWrites()).toBe(1);
  });

  it('runs a second write for the same key only after the first completes', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = writeSettingSerialized('np_test_serial', async () => {
      order.push('first:start');
      await gate;
      order.push('first:end');
    });
    const second = writeSettingSerialized('np_test_serial', async () => {
      order.push('second');
    });

    await flushMicrotasks();
    expect(order).toEqual(['first:start']);
    expect(__test__.getPendingSize()).toBe(1);

    release();
    await Promise.all([first, second]);

    expect(order).toEqual(['first:start', 'first:end', 'second']);
    await flushMicrotasks();
    expect(__test__.getPendingSize()).toBe(0);
  });

  it('does not serialise writes for different keys against each other', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = writeSettingSerialized('np_test_key_a', async () => {
      order.push('a:start');
      await gate;
      order.push('a:end');
    });
    const second = writeSettingSerialized('np_test_key_b', async () => {
      order.push('b');
    });

    await flushMicrotasks();
    expect(order).toEqual(['a:start', 'b']);

    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['a:start', 'b', 'a:end']);
  });

  it('a failed write does not cancel the next write for the same key', async () => {
    const order: string[] = [];

    const first = writeSettingSerialized('np_test_chain', async () => {
      order.push('first');
      throw new Error('write failed');
    });
    const second = writeSettingSerialized('np_test_chain', async () => {
      order.push('second');
    });

    await expect(first).rejects.toThrow('write failed');
    await second;

    expect(order).toEqual(['first', 'second']);
  });
});

describe('Setting — fail-closed on a malformed stored value (T-02-22)', () => {
  const malformedShapes: Array<[string, unknown]> = [
    ['base64 of 8 bytes', encode(new Uint8Array(8).fill(1))],
    ['a non-base64 string', 'not-base64!!!'],
    ['an empty string', ''],
    ['a non-string', 42],
  ];

  for (const [label, stored] of malformedShapes) {
    it(`reports a typed failure for ${label} and never overwrites it`, async () => {
      storageMap().set(SETTING_INSTALL_SECRET_KEY, stored);

      const result = await readInstallSecret();

      expect(result).toEqual({ ok: false, code: 'SETTING_INSTALL_SECRET_INVALID' });
      // The stored value is untouched — a usable-but-unreadable value must not
      // be silently regenerated over.
      expect(storedValue()).toBe(stored);
      expect(installSecretWrites()).toBe(0);
    });
  }

  it('accepts a stored value that is exactly the canonical 32-byte base64', async () => {
    const valid = encode(new Uint8Array(INSTALL_SECRET_BYTES).fill(9));
    storageMap().set(SETTING_INSTALL_SECRET_KEY, valid);

    expect(await readInstallSecret()).toEqual({ ok: true, value: valid });
    expect(installSecretWrites()).toBe(0);
  });
});

describe('Setting — read-back verification (OQ-6)', () => {
  it('reports no success when the read-back does not match the written value', async () => {
    const local = storageLocal();
    const originalGet = local.get;
    const originalSet = local.set;

    const divergent = encode(new Uint8Array(INSTALL_SECRET_BYTES).fill(7));
    // The divergent value is itself a valid install secret, so the failure can
    // only come from the read-back comparison — not from validation.
    expect(decode(divergent)).toHaveLength(INSTALL_SECRET_BYTES);

    let didWrite = false;
    local.set = ((items: Record<string, unknown>) => {
      didWrite = true;
      return originalSet(items);
    }) as typeof local.set;
    // The chrome typing is generic over the key set; this test drives the
    // Map-backed mock, so the plain record signature is what it needs.
    const read = originalGet as unknown as (
      keys?: string | string[] | null,
    ) => Promise<Record<string, unknown>>;
    local.get = ((keys?: string | string[] | null) =>
      didWrite
        ? Promise.resolve({ [SETTING_INSTALL_SECRET_KEY]: divergent })
        : read(keys)) as typeof local.get;

    try {
      const result = await readInstallSecret();

      expect(result).toEqual({ ok: false, code: 'SETTING_INSTALL_SECRET_UNVERIFIED' });
      expect(JSON.stringify(getRecentLogs())).toContain('SETTING_INSTALL_SECRET_UNVERIFIED');
    } finally {
      local.get = originalGet;
      local.set = originalSet;
    }
  });

  it('reports a typed read failure when the storage read throws', async () => {
    const local = storageLocal();
    const originalGet = local.get;
    local.get = (() =>
      Promise.reject(new DOMException('nope', 'UnknownError'))) as typeof local.get;

    try {
      const result = await readInstallSecret();

      expect(result).toEqual({ ok: false, code: 'SETTING_READ_FAILED' });
      expect(JSON.stringify(getRecentLogs())).toContain('SETTING_READ_FAILED');
    } finally {
      local.get = originalGet;
    }
  });

  it('reports a typed write failure when the storage write throws', async () => {
    const local = storageLocal();
    const originalSet = local.set;
    local.set = (() => Promise.reject(new Error('quota'))) as typeof local.set;

    try {
      const result = await readInstallSecret();

      expect(result).toEqual({ ok: false, code: 'SETTING_WRITE_FAILED' });
      expect(JSON.stringify(getRecentLogs())).toContain('SETTING_WRITE_FAILED');
    } finally {
      local.set = originalSet;
    }
  });
});

describe('Setting — storage-availability guard', () => {
  it('resolves a soft typed result when chrome.storage.local is absent', async () => {
    const storage = chrome.storage as unknown as Record<string, unknown>;
    const saved = storage.local;
    delete storage.local;

    try {
      const result: SettingResult = await readInstallSecret();

      expect(result).toEqual({ ok: false, code: 'SETTING_STORAGE_UNAVAILABLE' });
      expect(JSON.stringify(getRecentLogs())).toContain('SETTING_STORAGE_UNAVAILABLE');
    } finally {
      storage.local = saved;
    }
  });
});

describe('Setting — redaction discipline (§16.5)', () => {
  it('never logs the value, a fragment of it, or the key-adjacent material', async () => {
    const result = await readInstallSecret();
    const value = (result as { ok: true; value: string }).value;

    const logs = JSON.stringify(getRecentLogs());

    // Positive control: the creation was logged at all.
    expect(logs).toContain('SETTING_INSTALL_SECRET_CREATED');
    // Absence: neither the value nor any fragment of it is in the ring buffer.
    expect(logs).not.toContain(value);
    expect(logs).not.toContain(value.slice(0, 12));
    expect(logs).not.toContain(value.slice(-12));
  });

  it('keeps the stored form free of anything derived from the value', async () => {
    const result = await readInstallSecret();
    const value = (result as { ok: true; value: string }).value;

    // The persisted map holds exactly the base64 secret under exactly one key:
    // no length marker, no hash, no fingerprint, no second copy.
    const entries = [...storageMap().entries()];
    expect(entries).toEqual([[SETTING_INSTALL_SECRET_KEY, value]]);
  });
});

describe('Setting — the real Phase 2 consumer: KeyVault reads this secret (OQ-3)', () => {
  const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';

  it('is passed straight into createKeyVault and completes a credential round trip', async () => {
    // No adapter: `readInstallSecret` satisfies KeyVault's injected
    // `() => Promise<{ ok: true; value: string } | { ok: false; code }>` shape
    // as written.
    const vault = createKeyVault({
      extensionId: 'np-test-extension',
      storage: chrome.storage.local as unknown as StorageAreaLike,
      readInstallSecret,
    });

    expect(await vault.store('openai', SENTINEL)).toEqual({ ok: true });
    expect(await vault.retrieve('openai')).toEqual({ ok: true, credential: SENTINEL });

    // The secret the vault actually derived from is this module's lazy create.
    const secret = storedValue();
    expect(typeof secret).toBe('string');
    expect(decode(secret as string)).toHaveLength(INSTALL_SECRET_BYTES);

    // Two keys, two jobs: the secret and the encrypted envelope.
    expect([...storageMap().keys()].sort()).toEqual(
      ['np_credential_openai', SETTING_INSTALL_SECRET_KEY].sort(),
    );
    expect(JSON.stringify([...storageMap().entries()])).not.toContain(SENTINEL);
  });

  it('fails the vault closed when the install secret cannot be read', async () => {
    const storage = chrome.storage as unknown as Record<string, unknown>;
    const saved = storage.local;
    delete storage.local;

    try {
      const vault = createKeyVault({
        extensionId: 'np-test-extension',
        storage: saved as StorageAreaLike,
        readInstallSecret,
      });

      // The vault reports its own typed failure and persists nothing.
      expect(await vault.store('openai', SENTINEL)).toEqual({
        ok: false,
        code: 'KEY_VAULT_SECRET_UNAVAILABLE',
      });
      expect(storageMap().size).toBe(0);
    } finally {
      storage.local = saved;
    }
  });
});
