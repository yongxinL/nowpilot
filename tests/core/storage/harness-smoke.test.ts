import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';

/**
 * Harness smoke test — proves that the two Phase-2 test-env capabilities
 * wired into tests/setup.ts are actually available before any Phase-2 plan
 * relies on them:
 *
 *   1. A global `indexedDB` (fake-indexeddb) — used by idb-backed stores
 *      (WriteJournalDB, ErrorStore, IndexedDBMigrator in plans 02-04/05).
 *   2. A `chrome.storage.session` mock — used by WorkspaceElection CAS /
 *      heartbeat tests in plan 02-06.
 *
 * Each test resets both stores in beforeEach so case ordering cannot leak
 * state. The isolation case additionally verifies the `__resetIndexedDB`
 * helper produces a fresh factory (not reference-equal to the prior one).
 */

describe('Phase-2 test harness smoke (fake-indexeddb + session mock)', () => {
  beforeEach(() => {
    // Fresh IndexedDB factory per case — fake-indexeddb persists DBs across
    // runs within the same factory instance unless we swap it out.
    (globalThis as any).__resetIndexedDB();

    // Clear the session mock between cases so round-trip assertions don't
    // see leftover keys from a previous run.
    const sessionMap = (globalThis as any).__chromeSessionMap as Map<string, string> | undefined;
    sessionMap?.clear();
    const syncMap = (globalThis as any).__chromeStorageMap as Map<string, string> | undefined;
    syncMap?.clear();
  });

  it('exposes a working global indexedDB (fake-indexeddb) with idb round-trip', async () => {
    expect(indexedDB).toBeDefined();

    const db = await openDB('SmokeDB', 1, {
      upgrade(database) {
        database.createObjectStore('t');
      },
    });

    try {
      await db.put('t', 'hello', 'greeting');
      const value = await db.get('t', 'greeting');
      expect(value).toBe('hello');
    } finally {
      db.close();
    }

    // Clean up the database so repeated test runs start clean even if the
    // factory isn't reset between invocations.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('SmokeDB');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });

  it('round-trips values through chrome.storage.session and tracks them in __chromeSessionMap', async () => {
    expect(chrome.storage.session).toBeDefined();

    const record = { tabId: 1, surface: 'sidepanel' as const, electedAt: 123 };
    await chrome.storage.session.set({ np_workspace_primary: record });

    const sessionMap = (globalThis as any).__chromeSessionMap as Map<string, string>;
    expect(sessionMap.has('np_workspace_primary')).toBe(true);

    const read = await chrome.storage.session.get('np_workspace_primary');
    expect(read.np_workspace_primary).toEqual(record);
  });

  it('__resetIndexedDB replaces the global factory with a fresh instance', () => {
    const before = indexedDB;
    expect(before).toBeDefined();

    (globalThis as any).__resetIndexedDB();
    const after = indexedDB;

    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });
});
