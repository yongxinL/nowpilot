// tests/core/storage/Setting.test.ts — STORAGE-02 Setting layer contract tests
// (D-09/D-10/D-11). Setting.ts is the per-key permissioned typed wrapper over
// chrome.storage: the permission table routes np_theme → sync and np_workspace →
// local (test 1), the promise-chain mutex serializes concurrent writes (test 2,
// §13 "never two Setting<T> keys concurrently"), the encrypted-only contract
// refuses raw np_providers values (test 3, A-11), runMigrateOnRead normalizes
// old KV shapes via np_schema_version (test 4, D-10), and the five session keys
// are declared-only with no accessors (test 5, D-11). Sync-shadow cases (D-15)
// land in 02-08 with the quota-shadow fixture: sync write failure falls back to
// a same-key local shadow, a shadow wins reads and re-attempts sync, a
// successful sync write deletes the shadow, and cosmetic writes are debounced.
// Uses the wxt fakeBrowser chrome.* stubs (all areas incl. session/sync) — same
// pattern as WorkspaceStore.test.ts; runs in the default jsdom-align
// environment. fakeBrowser does NOT enforce sync quotas (A-17) — set()
// rejections are mocked per the fixture.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import * as SettingModule from '@/core/storage/Setting';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_MIGRATE_SANITIZERS,
  NP_SCHEMA_VERSION_KEY,
  STORAGE_KEY_REGISTRY,
  runMigrateOnRead,
  settingRead,
  settingReadSync,
  settingWrite,
  settingWriteSync,
} from '@/core/storage/Setting';
import { buildQuotaShadowFixture } from '../../fixtures/index';

const SESSION_KEYS = [
  'np_jsessionid',
  'np_sysparm_ck',
  'np_token_ttl',
  'np_active_stream',
  'np_workspace_primary',
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Setting — permission table enforcement', () => {
  it('refuses writes to an unknown key (writeAllowed false default) without throwing', async () => {
    const localSet = vi.spyOn(fakeBrowser.storage.local, 'set');

    await expect(settingWrite('np_does_not_exist', 42)).resolves.toBeUndefined();

    expect(localSet).not.toHaveBeenCalled();
  });

  it('routes np_theme writes to the sync area and np_workspace writes to local', async () => {
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set');
    const localSet = vi.spyOn(fakeBrowser.storage.local, 'set');

    await settingWrite('np_theme', 'dark');
    expect(syncSet).toHaveBeenCalledWith({ np_theme: 'dark' });
    expect(localSet).not.toHaveBeenCalled();

    await settingWrite('np_workspace', { workspaceId: 'ws-1' });
    expect(localSet).toHaveBeenCalledWith({ np_workspace: { workspaceId: 'ws-1' } });
    expect(syncSet).toHaveBeenCalledTimes(1);
  });
});

describe('Setting — serialized writes (promise-chain mutex)', () => {
  it('starts the second concurrent write only after the first settles (no interleaved set)', async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let first = true;
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(
      async (items: Record<string, unknown>) => {
        order.push(Object.keys(items)[0]);
        if (first) {
          first = false;
          await gate; // slow first write — the mutex must hold the second
        }
      },
    );

    const p1 = settingWrite('np_workspace', { workspaceId: 'ws-1' });
    const p2 = settingWrite('np_addon_settings', { addon1: { theme: 'dark' } });
    try {
      // Give the microtask chain a chance to start the first write only.
      await vi.waitFor(() => expect(order).toEqual(['np_workspace']));
    } finally {
      releaseFirst(); // never wedge the module-level mutex for later tests
    }

    await Promise.all([p1, p2]);
    expect(order).toEqual(['np_workspace', 'np_addon_settings']);
  });
});

describe('Setting — encrypted-only contract (A-11)', () => {
  it('refuses a raw (non-envelope) np_providers write and passes an envelope-shaped value', async () => {
    const localSet = vi.spyOn(fakeBrowser.storage.local, 'set');

    await settingWrite('np_providers', { apiKey: 'sk-raw-plaintext' });
    expect(localSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ np_providers: expect.anything() }) as Record<string, unknown>,
    );

    const envelope = {
      salt: new Uint8Array(16),
      iv: new Uint8Array(12),
      ciphertext: new Uint8Array(8),
    };
    await settingWrite('np_providers', envelope);
    expect(localSet).toHaveBeenCalledWith({ np_providers: envelope });
  });
});

describe('Setting — migrate-on-read (np_schema_version, D-10)', () => {
  it('normalizes an old np_workspace shape to the current shape and stamps the schema version', async () => {
    // Old shape: carries the current active fields PLUS an obsolete field name
    // that the current sanitizeStored drops (generalized T-1-13).
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: 'ws-old',
        conversationId: 'conv-old',
        activeSurface: 'sidepanel',
        version: 3,
        updatedAt: 3000,
        obsoleteFieldName: 'legacy',
      },
    });

    await runMigrateOnRead(DEFAULT_MIGRATE_SANITIZERS);

    const stored = (await fakeBrowser.storage.local.get([
      NP_SCHEMA_VERSION_KEY,
      'np_workspace',
    ])) as Record<string, Record<string, unknown>>;
    expect(stored.np_workspace).not.toHaveProperty('obsoleteFieldName');
    expect(stored.np_workspace.workspaceId).toBe('ws-old');
    expect(stored[NP_SCHEMA_VERSION_KEY]).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('is a no-op on a fresh install except stamping the schema version', async () => {
    await runMigrateOnRead(DEFAULT_MIGRATE_SANITIZERS);

    const stored = await fakeBrowser.storage.local.get([
      NP_SCHEMA_VERSION_KEY,
      'np_workspace',
      'np_addon_settings',
    ]);
    expect(stored.np_workspace).toBeUndefined();
    expect(stored.np_addon_settings).toBeUndefined();
    expect(stored[NP_SCHEMA_VERSION_KEY]).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('Setting — session keys declared-only (D-11)', () => {
  it('declares the five session keys in the registry with no accessor functions', async () => {
    for (const key of SESSION_KEYS) {
      expect(STORAGE_KEY_REGISTRY[key]).toBeDefined();
      expect(STORAGE_KEY_REGISTRY[key].area).toBe('session');
    }

    // No exported getter/setter function name references a session key.
    const exportedNames = Object.keys(SettingModule);
    for (const key of SESSION_KEYS) {
      const accessorLike = exportedNames.filter((name) =>
        name.toLowerCase().includes(key.replace('np_', '')),
      );
      expect(accessorLike).toEqual([]);
    }

    // Declared-only keys are mechanically unwritable through the generic path.
    const sessionSet = vi.spyOn(fakeBrowser.storage.session, 'set');
    await settingWrite('np_jsessionid', 'tok-abc');
    expect(sessionSet).not.toHaveBeenCalled();
    await expect(
      settingRead('np_jsessionid', (v: unknown) => v as string, 'fallback'),
    ).resolves.toBe('fallback');
  });
});

describe('Setting — sync-shadow fallback (D-15, quota-shadow fixture)', () => {
  // Cosmetic keys are debounced (100ms window, RESEARCH A1) so the tests drive
  // the debounce deterministically with fake timers.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers(); // discards any pending debounce timer (no cross-test leak)
    vi.restoreAllMocks();
  });

  it('sync write failure falls back to a same-key local shadow and logs SYNC_QUOTA_EXCEEDED', async () => {
    const fixture = buildQuotaShadowFixture();
    vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(fixture.syncRejectError);
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const p = settingWriteSync(fixture.key, fixture.value);
    await vi.advanceTimersByTimeAsync(200); // fire the debounce → sync write → shadow
    await p;

    const local = await fakeBrowser.storage.local.get(fixture.key);
    expect(local[fixture.key]).toBe(fixture.value); // shadow present
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('SYNC_QUOTA_EXCEEDED'),
      expect.any(String),
      expect.objectContaining({ key: fixture.key }),
    );
  });

  it('a local shadow wins the read and triggers a re-attempt to write sync', async () => {
    const fixture = buildQuotaShadowFixture();
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set');
    // Seed a local-only shadow; the sync area holds nothing.
    await fakeBrowser.storage.local.set({ [fixture.key]: fixture.value });

    const result = await settingReadSync(
      fixture.key,
      (v: unknown) => (typeof v === 'string' ? v : null),
      'fallback',
    );
    expect(result).toBe(fixture.value); // shadow wins

    await vi.advanceTimersByTimeAsync(200); // flush the debounced re-attempt
    expect(syncSet).toHaveBeenCalledWith({ [fixture.key]: fixture.value });

    // The successful re-attempt deletes the shadow — sync/local never diverge.
    const local = await fakeBrowser.storage.local.get(fixture.key);
    expect(local[fixture.key]).toBeUndefined();
  });

  it('a sync READ rejection still consults the local shadow before returning fallback (WR-06)', async () => {
    const fixture = buildQuotaShadowFixture();
    // The sync area REJECTS the read entirely; a durable local shadow exists.
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockRejectedValue(fixture.syncRejectError);
    await fakeBrowser.storage.local.set({ [fixture.key]: fixture.value });

    const result = await settingReadSync(
      fixture.key,
      (v: unknown) => (typeof v === 'string' ? v : null),
      'fallback',
    );
    // The shadow is visible to the UI despite the sync-read failure — the
    // durable value is never hidden behind a broken sync read.
    expect(result).toBe(fixture.value);
  });

  it('a sync READ rejection with NO shadow returns fallback (WR-06)', async () => {
    const fixture = buildQuotaShadowFixture();
    vi.spyOn(fakeBrowser.storage.sync, 'get').mockRejectedValue(fixture.syncRejectError);

    const result = await settingReadSync(
      fixture.key,
      (v: unknown) => (typeof v === 'string' ? v : null),
      'fallback',
    );
    expect(result).toBe('fallback');
  });

  it('a successful sync write deletes any local shadow (reconciliation)', async () => {
    const fixture = buildQuotaShadowFixture();
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set');
    await fakeBrowser.storage.local.set({ [fixture.key]: fixture.value }); // stale shadow

    const p = settingWriteSync(fixture.key, 'light');
    await vi.advanceTimersByTimeAsync(200);
    await p;

    expect(syncSet).toHaveBeenCalledWith({ [fixture.key]: 'light' });
    const local = await fakeBrowser.storage.local.get(fixture.key);
    expect(local[fixture.key]).toBeUndefined();
  });

  it('a successful sync write never creates a local shadow (happy path)', async () => {
    const fixture = buildQuotaShadowFixture();
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set');
    const localSet = vi.spyOn(fakeBrowser.storage.local, 'set');

    const p = settingWriteSync(fixture.key, fixture.value);
    await vi.advanceTimersByTimeAsync(200);
    await p;

    expect(syncSet).toHaveBeenCalledWith({ [fixture.key]: fixture.value });
    expect(localSet).not.toHaveBeenCalled(); // no shadow write
    const local = await fakeBrowser.storage.local.get(fixture.key);
    expect(local[fixture.key]).toBeUndefined();
  });

  it('debounces cosmetic writes — a rapid burst lands only the last value in sync', async () => {
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set');

    const p1 = settingWriteSync('np_theme', 'light');
    const p2 = settingWriteSync('np_theme', 'dark'); // supersedes p1 — last value wins
    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([p1, p2]);

    expect(syncSet).toHaveBeenCalledTimes(1);
    expect(syncSet).toHaveBeenCalledWith({ np_theme: 'dark' });
  });
});
