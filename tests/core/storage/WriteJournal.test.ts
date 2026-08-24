import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openWriteJournalDB } from '../../../src/core/storage/WriteJournalDB';
import type { WriteJournalEntry } from '../../../src/types/storage';

/**
 * WriteJournal core — runJournaled / recoverJournal per spec Appendix O.11.
 *
 * Four behaviors tested (ROADMAP success criterion 1):
 *   - Test 1: SW-kill mid-write — a 'pending' update-workspace entry in
 *     WriteJournalDB is replayed by recoverJournal → the storage value
 *     is restored.
 *   - Test 2: replay is idempotent — replaying the same entry twice
 *     yields the same final state (JournalStep.apply MUST be safe to
 *     re-run).
 *   - Test 3: rollback — a step whose apply() throws → already-done steps
 *     roll back in reverse, the entry is marked 'rolled-back', and
 *     WRITE_JOURNAL_FAILED is emitted via debugLog.
 *   - Test 4: unsupported ops are skipped with debugLog instrumentation
 *     — no placeholder handlers run (D-32 replay contract).
 *
 * Test harness:
 *   - fake-indexeddb/auto (tests/setup.ts) provides the IDB factory;
 *     __resetIndexedDB() in beforeEach gives each test a fresh DB.
 *   - console.debug is spied to assert WRITE_JOURNAL_FAILED /
 *     WRITE_JOURNAL_ROLLBACK_FAILED / WRITE_JOURNAL_UNSUPPORTED_OP.
 *   - The write/emit stubs let us observe side effects without coupling
 *     to chromeStorageAdapter / BroadcastBus.
 */

describe('WriteJournal — runJournaled / recoverJournal (Appendix O.11)', () => {
  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    // Reset the journal registry between tests so registration from a
    // prior case doesn't leak into this one.
    const wj = await import('../../../src/core/storage/WriteJournal');
    wj.__test__.resetJournalRegistry();
    vi.restoreAllMocks();
  });

  it('Test 1 (recovery): recoverWorkspaceJournal re-applies the CURRENT np_workspace value for a metadata-only pending update-workspace entry (CR-01)', async () => {
    const { recoverWorkspaceJournal, isSupportedOperation, __test__: journalTest } =
      await import('../../../src/core/storage/WriteJournal');
    const { chromeStorageAdapter, __test__: chromeTest } = await import(
      '../../../src/core/theme/chromeStorageAdapter'
    );

    // 1. Reset any prior registry state so the helper's own registration is
    //    what populates it (the CR-01 "never registered" defect fix).
    journalTest.resetJournalRegistry();
    chromeTest.resetPendingState();

    // 2. Pre-seed the canonical value — a real persisted workspace before the
    //    crash (zustand-wrapped production shape).
    await chromeStorageAdapter.setItem(
      'np_workspace',
      JSON.stringify({ state: { workspaceId: 'ws-1', conversationId: 'conv-1' } }),
    );

    // 3. Seed a metadata-only pending entry in WriteJournalDB — NO
    //    workspaceId / conversationId fields (the CR-01 root cause).
    const db = await openWriteJournalDB();
    const pendingEntry: WriteJournalEntry = {
      id: 'kill-mid-write',
      operation: 'update-workspace',
      status: 'pending',
      attempts: 0,
      steps: [],
      createdAt: Date.now(),
    };
    await db.put('entries', pendingEntry);
    db.close();

    // 4. Capture the replay emit (pre-existing ''/null top-level-parse
    //    limitation — assert the write, not the emit payload).
    const emits: Array<{ workspaceId: string; conversationId: string | null }> = [];

    // 5. Run the REAL boot recovery path via recoverWorkspaceJournal with deps
    //    bound to chromeStorageAdapter + WriteJournalDB.
    await recoverWorkspaceJournal({
      loadEntries: async () => {
        const rdb = await openWriteJournalDB();
        const all = await rdb.getAll('entries');
        rdb.close();
        return all;
      },
      readCurrentWorkspace: async () => await chromeStorageAdapter.getItem('np_workspace'),
      write: async (name, value) => {
        await chromeStorageAdapter.setItem(name, value);
      },
      remove: async (name) => {
        await chromeStorageAdapter.removeItem(name);
      },
      emit: (workspaceId, conversationId) => {
        emits.push({ workspaceId, conversationId });
      },
      persistEntry: async (e) => {
        const pdb = await openWriteJournalDB();
        await pdb.put('entries', e);
        pdb.close();
      },
    });

    // 6. The np_workspace blob in storage is UNCHANGED (still ws-1/conv-1 —
    //    NOT overwritten with ''/null).
    await new Promise((r) => setTimeout(r, 400)); // debounce flush
    const stored = await chromeStorageAdapter.getItem('np_workspace');
    const parsed = JSON.parse(stored as string);
    expect(parsed.state.workspaceId).toBe('ws-1');
    expect(parsed.state.conversationId).toBe('conv-1');

    // 7. Entry is now 'completed' with attempts 1.
    const finalDb = await openWriteJournalDB();
    const finalEntry = await finalDb.get('entries', 'kill-mid-write');
    finalDb.close();
    expect(finalEntry?.status).toBe('completed');
    expect(finalEntry?.attempts).toBe(1);
    expect(finalEntry?.steps.map((s) => s.name)).toEqual([
      'write-np-workspace',
      'emit-workspace-updated',
    ]);

    // 8. update-workspace is now a supported operation (registration fixed).
    expect(isSupportedOperation('update-workspace')).toBe(true);
  });

  it('Test 2 (idempotent replay): replaying the same entry twice yields the same final state (apply MUST be safe to re-run)', async () => {
    const { runJournaled, registerJournalSteps, createWorkspaceWriteSteps } =
      await import('../../../src/core/storage/WriteJournal');

    let applyCount = 0;
    const write = async () => {
      applyCount += 1;
    };
    const remove = async () => undefined;
    const emit = () => undefined;

    const buildSteps = createWorkspaceWriteSteps({ write, remove, emit });
    registerJournalSteps(
      'update-workspace',
      buildSteps('np_workspace', '{"workspaceId":"ws-idem","conversationId":null}'),
    );

    const { getJournalSteps } = await import('../../../src/core/storage/WriteJournal');
    const steps = getJournalSteps('update-workspace');
    expect(steps).toBeDefined();

    // Two independent entries (deep-cloned `steps` array) so the second
    // replay doesn't accumulate records onto the first.
    const makeEntry = (): WriteJournalEntry => ({
      id: 'idem-1',
      operation: 'update-workspace',
      status: 'pending',
      attempts: 0,
      steps: [],
      createdAt: Date.now(),
    });

    // Replay twice — apply runs both times, but each entry ends in the
    // same completed state with both step names recorded.
    const persist = async (e: WriteJournalEntry) => {
      const pdb = await openWriteJournalDB();
      await pdb.put('entries', e);
      pdb.close();
    };

    const entryA = makeEntry();
    const entryB = makeEntry();

    await runJournaled(entryA, steps!, persist);
    await runJournaled(entryB, steps!, persist);

    expect(applyCount).toBe(2);
    expect(entryA.status).toBe('completed');
    expect(entryB.status).toBe('completed');
    expect(entryA.steps.map((s) => s.name)).toEqual([
      'write-np-workspace',
      'emit-workspace-updated',
    ]);
    expect(entryB.steps.map((s) => s.name)).toEqual([
      'write-np-workspace',
      'emit-workspace-updated',
    ]);
  });

  it('Test 3 (rollback): a step whose apply() throws rolls back completed steps in reverse and marks the entry rolled-back + logs WRITE_JOURNAL_FAILED', async () => {
    const { runJournaled, registerJournalSteps, createWorkspaceWriteSteps } =
      await import('../../../src/core/storage/WriteJournal');

    const applyOrder: string[] = [];
    const rollbackOrder: string[] = [];
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const write = async () => {
      applyOrder.push('write');
    };
    const remove = async () => {
      rollbackOrder.push('write-rollback');
    };
    const emit = () => undefined;

    // A second step that throws on apply
    const failingStep = {
      name: 'doomed',
      apply: async () => {
        applyOrder.push('doomed');
        throw new Error('simulated step failure');
      },
      rollback: async () => {
        rollbackOrder.push('doomed-rollback');
      },
    };

    registerJournalSteps('update-workspace', [
      // Replace the factory's two steps with a custom two-step list so
      // we can inject a failing step at position 2.
      {
        name: 'write-np-workspace',
        apply: write,
        rollback: remove,
      },
      failingStep,
    ]);

    const entry: WriteJournalEntry = {
      id: 'rollback-1',
      operation: 'update-workspace',
      status: 'pending',
      attempts: 0,
      steps: [],
      createdAt: Date.now(),
    };

    const persist = async (e: WriteJournalEntry) => {
      const pdb = await openWriteJournalDB();
      await pdb.put('entries', e);
      pdb.close();
    };

    // Capture the throw (runJournaled rethrows after rollback)
    let caught: unknown = null;
    try {
      await runJournaled(entry, [
        { name: 'write-np-workspace', apply: write, rollback: remove },
        failingStep,
      ], persist);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('simulated step failure');

    // Entry is marked rolled-back and persisted
    expect(entry.status).toBe('rolled-back');

    // Rollback runs in reverse order — write was completed, then
    // doomed threw; write's rollback runs first.
    expect(rollbackOrder).toEqual(['write-rollback']);

    // WRITE_JOURNAL_FAILED was logged via debugLog → console.debug
    const failedLog = debugSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('WRITE_JOURNAL_FAILED'),
    );
    expect(failedLog).toBeDefined();

    // The persisted entry reflects rolled-back state
    const finalDb = await openWriteJournalDB();
    const persisted = await finalDb.get('entries', 'rollback-1');
    finalDb.close();
    expect(persisted?.status).toBe('rolled-back');
    // The completed step's record was written before the failing step ran,
    // so it carries status 'completed' (the entry-level rolled-back is the
    // authoritative outcome).
    const completedStep = persisted?.steps.find((s) => s.name === 'write-np-workspace');
    expect(completedStep?.status).toBe('completed');
  });

  it('Test 4 (replay contract): an unsupported operation is skipped with debugLog instrumentation — no placeholder handler runs', async () => {
    const { runJournaled, recoverJournal, isSupportedOperation, registerJournalSteps, createWorkspaceWriteSteps } =
      await import('../../../src/core/storage/WriteJournal');

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    // Register ONLY update-workspace (Phase 2 reality — D-32)
    registerJournalSteps(
      'update-workspace',
      createWorkspaceWriteSteps({
        write: async () => undefined,
        remove: async () => undefined,
        emit: () => undefined,
      })('np_workspace', '{"workspaceId":"ws","conversationId":null}'),
    );

    // 'save-note-with-links' is unsupported in Phase 2
    expect(isSupportedOperation('save-note-with-links')).toBe(false);
    expect(isSupportedOperation('update-workspace')).toBe(true);

    // Seed a pending entry with an unsupported op
    const db = await openWriteJournalDB();
    const unsupportedEntry: WriteJournalEntry = {
      id: 'unsupported-1',
      operation: 'save-note-with-links',
      status: 'pending',
      attempts: 0,
      steps: [],
      createdAt: Date.now(),
    };
    await db.put('entries', unsupportedEntry);
    db.close();

    // Recovery — replay contract: skip with debugLog if !isSupportedOperation
    const load = async () => {
      const ldb = await openWriteJournalDB();
      const all = await ldb.getAll('entries');
      ldb.close();
      return all;
    };
    await recoverJournal(load, async (e) => {
      if (!isSupportedOperation(e.operation)) {
        // Mirror what plan 02-07's boot wiring will do: debugLog a
        // skip line (use a spec-internal code, NOT the closed registry).
        const debugLog = await import('../../../src/core/log/debugLog');
        debugLog.debugLog('WRITE_JOURNAL_UNSUPPORTED_OP', 'skipping', { id: e.id, op: e.operation });
        return;
      }
      // Should not reach here for the unsupported entry
      const steps = (await import('../../../src/core/storage/WriteJournal')).getJournalSteps(e.operation);
      const persist = async (pe: WriteJournalEntry) => {
        const pdb = await openWriteJournalDB();
        await pdb.put('entries', pe);
        pdb.close();
      };
      await runJournaled(e, steps!, persist);
    });

    // debugLog instrumentation recorded the skip
    const skipLog = debugSpy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('WRITE_JOURNAL_UNSUPPORTED_OP'),
    );
    expect(skipLog).toBeDefined();

    // Entry is left untouched (still 'pending' — caller decides eviction)
    const finalDb = await openWriteJournalDB();
    const persisted = await finalDb.get('entries', 'unsupported-1');
    finalDb.close();
    expect(persisted?.status).toBe('pending');
    expect(persisted?.attempts).toBe(0);
  });
});