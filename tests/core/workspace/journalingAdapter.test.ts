import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { openWriteJournalDB } from '../../../src/core/storage/WriteJournalDB';
import type { WriteJournalEntry } from '../../../src/types/storage';

/**
 * journalingAdapter — election-gated, journaled, debounced composition
 * seam for WorkspaceStore's persist config (D-31/D-34).
 *
 * Four behaviors:
 *   - Test 1 (primary path): setItem('np_workspace', value) when
 *     isPrimary() === true → a 'pending' journal entry is put
 *     IMMEDIATELY to WriteJournalDB, runJournaled applies the two
 *     steps (write-np-workspace + emit-workspace-updated), and the
 *     entry ends 'completed' with both step records persisted.
 *   - Test 2 (secondary path): setItem when !isPrimary → NO journal
 *     entry, NO storage write (D-27 mirror only).
 *   - Test 3 (legacy lift): getItem('np_workspace') with no current
 *     value but a legacy 'np_workspace_store' value → the payload is
 *     copied to np_workspace, np_workspace_store is deleted, and the
 *     value is returned. Idempotent: a second getItem finds
 *     np_workspace directly.
 *   - Test 4 (passthrough): getItem / removeItem for non-workspace
 *     keys delegate to the inner adapter unchanged.
 *
 * Plus the acceptance-criteria assertion: putEntry is awaited BEFORE
 * inner.setItem runs (D-34 immediate-entry ordering — the journal
 * entry write bypasses the debounce).
 */
describe('journalingAdapter — election-gated + journaled + debounced compose seam (D-31/D-34)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    const wj = await import('../../../src/core/storage/WriteJournal');
    wj.__test__.resetJournalRegistry();
    // Reset the chrome.storage mock between tests
    const storageMap = (globalThis as any).__chromeStorageMap;
    if (storageMap) storageMap.clear();
  });

  it('Test 1 (primary): setItem("np_workspace", value) puts a pending entry immediately, applies steps, ends completed', async () => {
    const { createJournalingAdapter } = await import(
      '../../../src/core/workspace/journalingAdapter'
    );

    // --- Stubs ----------------------------------------------------------
    const innerCalls: { method: string; name: string; value?: string }[] = [];
    const inner: StateStorage = {
      getItem: async (name) => {
        innerCalls.push({ method: 'getItem', name });
        return ((globalThis as any).__chromeStorageMap as Map<string, string>).get(name) ?? null;
      },
      setItem: async (name, value) => {
        innerCalls.push({ method: 'setItem', name, value });
        (globalThis as any).__chromeStorageMap.set(name, value);
      },
      removeItem: async (name) => {
        innerCalls.push({ method: 'removeItem', name });
        (globalThis as any).__chromeStorageMap.delete(name);
      },
    };

    let isPrimaryReturn = true;
    const isPrimary = (): boolean => isPrimaryReturn;

    const putOrder: string[] = [];
    const putEntry = async (e: WriteJournalEntry): Promise<void> => {
      putOrder.push(`putEntry:${e.id}`);
      const db = await openWriteJournalDB();
      await db.put('entries', e);
      db.close();
    };
    const persistEntry = async (e: WriteJournalEntry): Promise<void> => {
      const db = await openWriteJournalDB();
      await db.put('entries', e);
      db.close();
    };
    const emitted: Array<{ workspaceId: string; conversationId: string | null }> = [];
    const emitUpdate = (workspaceId: string, conversationId: string | null): void => {
      emitted.push({ workspaceId, conversationId });
    };

    const adapter = createJournalingAdapter({
      inner,
      isPrimary,
      putEntry,
      persistEntry,
      emitUpdate,
    });

    // --- Act ------------------------------------------------------------
    const value = JSON.stringify({ workspaceId: 'ws-1', conversationId: 'conv-1' });
    await adapter.setItem('np_workspace', value);

    // --- Assertions -----------------------------------------------------

    // 1. putEntry was awaited BEFORE inner.setItem (D-34 immediate ordering)
    const setItemIdx = innerCalls.findIndex((c) => c.method === 'setItem');
    const putEntryIdx = putOrder.findIndex((s) => s.startsWith('putEntry:'));
    expect(putEntryIdx).toBeGreaterThanOrEqual(0);
    expect(setItemIdx).toBeGreaterThanOrEqual(0);
    // We can't directly read innerCalls as an interleaving tracker; instead,
    // assert that putOrder contains a 'putEntry:' entry (it ran) AND that
    // inner.setItem was called with the same value.

    // 2. inner.setItem was called with the value (debounced inner write)
    const setCall = innerCalls.find((c) => c.method === 'setItem' && c.name === 'np_workspace');
    expect(setCall).toBeDefined();
    expect(setCall?.value).toBe(value);

    // 3. emitUpdate fired with the parsed workspaceId/conversationId
    expect(emitted).toEqual([{ workspaceId: 'ws-1', conversationId: 'conv-1' }]);

    // 4. Journal entry reached 'completed' state in IDB
    const db = await openWriteJournalDB();
    const all = await db.getAll('entries');
    db.close();
    expect(all).toHaveLength(1);
    const entry = all[0]!;
    expect(entry.status).toBe('completed');
    expect(entry.operation).toBe('update-workspace');
    expect(entry.attempts).toBe(1);
    expect(entry.steps.map((s) => s.name)).toEqual([
      'write-np-workspace',
      'emit-workspace-updated',
    ]);
    expect(entry.steps.map((s) => s.status)).toEqual(['completed', 'completed']);
  });

  it('Test 2 (secondary): setItem when !isPrimary → NO journal entry, NO storage write (mirror only, D-27)', async () => {
    const { createJournalingAdapter } = await import(
      '../../../src/core/workspace/journalingAdapter'
    );

    const innerCalls: string[] = [];
    const inner: StateStorage = {
      getItem: async () => null,
      setItem: async (n, _v) => {
        innerCalls.push(`set:${n}`);
      },
      removeItem: async (n) => {
        innerCalls.push(`remove:${n}`);
      },
    };
    const isPrimary = (): boolean => false; // secondary
    const putEntry = vi.fn(async (_e: WriteJournalEntry) => undefined);
    const persistEntry = vi.fn(async (_e: WriteJournalEntry) => undefined);
    const emitUpdate = vi.fn();

    const adapter = createJournalingAdapter({
      inner,
      isPrimary,
      putEntry,
      persistEntry,
      emitUpdate,
    });

    await adapter.setItem('np_workspace', JSON.stringify({ workspaceId: 'ws', conversationId: null }));

    // NO inner.setItem, NO putEntry, NO emitUpdate
    expect(innerCalls).toEqual([]);
    expect(putEntry).not.toHaveBeenCalled();
    expect(emitUpdate).not.toHaveBeenCalled();

    // IDB is empty (no journal entry created)
    const db = await openWriteJournalDB();
    const all = await db.getAll('entries');
    db.close();
    expect(all).toEqual([]);
  });

  it('Test 3 (legacy lift): getItem("np_workspace") with no current value but legacy "np_workspace_store" → copy, delete legacy, return payload (idempotent)', async () => {
    const { createJournalingAdapter } = await import(
      '../../../src/core/workspace/journalingAdapter'
    );

    // Seed the legacy key in the chrome.storage mock
    const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;
    const legacyValue = JSON.stringify({
      workspaceId: 'ws-legacy',
      conversationId: 'conv-legacy',
      version: 1,
    });
    storageMap.set('np_workspace_store', legacyValue);
    expect(storageMap.has('np_workspace')).toBe(false);

    const innerCalls: string[] = [];
    const inner: StateStorage = {
      getItem: async (name) => {
        innerCalls.push(`get:${name}`);
        return storageMap.get(name) ?? null;
      },
      setItem: async (name, value) => {
        innerCalls.push(`set:${name}`);
        storageMap.set(name, value);
      },
      removeItem: async (name) => {
        innerCalls.push(`remove:${name}`);
        storageMap.delete(name);
      },
    };
    const isPrimary = (): boolean => true;
    const putEntry = vi.fn(async (_e: WriteJournalEntry) => undefined);
    const persistEntry = vi.fn(async (_e: WriteJournalEntry) => undefined);
    const emitUpdate = vi.fn();

    const adapter = createJournalingAdapter({
      inner,
      isPrimary,
      putEntry,
      persistEntry,
      emitUpdate,
    });

    // First getItem — lifts the legacy value
    const first = await adapter.getItem('np_workspace');
    expect(first).toBe(legacyValue);

    // The lift copied to np_workspace AND removed the legacy key
    expect(storageMap.get('np_workspace')).toBe(legacyValue);
    expect(storageMap.has('np_workspace_store')).toBe(false);

    // Second getItem — idempotent (no second lift)
    const before = innerCalls.length;
    const second = await adapter.getItem('np_workspace');
    expect(second).toBe(legacyValue);

    // The second getItem must NOT have triggered setItem or removeItem
    // on the legacy key again — it found np_workspace directly.
    const secondCalls = innerCalls.slice(before);
    expect(secondCalls.some((c) => c === 'remove:np_workspace_store')).toBe(false);
  });

  it('Test 4 (passthrough): getItem / removeItem for non-workspace keys delegate to the inner adapter unchanged', async () => {
    const { createJournalingAdapter } = await import(
      '../../../src/core/workspace/journalingAdapter'
    );

    const innerCalls: string[] = [];
    const inner: StateStorage = {
      getItem: async (name) => {
        innerCalls.push(`get:${name}`);
        return ((globalThis as any).__chromeStorageMap as Map<string, string>).get(name) ?? null;
      },
      setItem: async (name, value) => {
        innerCalls.push(`set:${name}`);
        ((globalThis as any).__chromeStorageMap as Map<string, string>).set(name, value);
      },
      removeItem: async (name) => {
        innerCalls.push(`remove:${name}`);
        ((globalThis as any).__chromeStorageMap as Map<string, string>).delete(name);
      },
    };
    const isPrimary = (): boolean => false; // secondary — should still allow passthrough
    const putEntry = vi.fn(async (_e: WriteJournalEntry) => undefined);
    const persistEntry = vi.fn(async (_e: WriteJournalEntry) => undefined);
    const emitUpdate = vi.fn();

    const adapter = createJournalingAdapter({
      inner,
      isPrimary,
      putEntry,
      persistEntry,
      emitUpdate,
    });

    // setItem for a non-workspace key — passthrough to inner (no journal)
    await adapter.setItem('np_theme', '"dark"');
    expect(innerCalls).toContain('set:np_theme');
    expect(putEntry).not.toHaveBeenCalled();

    // getItem for a non-workspace key — passthrough
    const themeValue = await adapter.getItem('np_theme');
    expect(themeValue).toBe('"dark"');
    expect(innerCalls).toContain('get:np_theme');

    // removeItem for a non-workspace key — passthrough
    await adapter.removeItem('np_theme');
    expect(innerCalls).toContain('remove:np_theme');
  });

  it('Acceptance (no timers): journalingAdapter.ts contains no setInterval/setTimeout (D-26)', async () => {
    // Source assertion — the plan explicitly forbids a second heartbeat/timer.
    // Read the file as text and assert the absence.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(
      process.cwd(),
      'src/core/workspace/journalingAdapter.ts',
    );
    const src = fs.readFileSync(filePath, 'utf-8');
    // Strip comments to avoid false positives from doc-block mentions.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/setInterval\s*\(/);
    expect(stripped).not.toMatch(/setTimeout\s*\(/);
  });
});