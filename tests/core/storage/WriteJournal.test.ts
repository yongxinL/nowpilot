import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MIGRATION_STAGE_NAMES,
  WRITE_JOURNAL_STATUSES,
  buildJournalEntry,
  compactJournal,
  createJournalEntry,
  parseWriteJournalEntry,
  recoverJournal,
  runJournaled,
  type JournalEntryStore,
  type JournalStep,
  type WriteJournalEntry,
} from '../../../src/core/storage/WriteJournal';
import { clearLogs, getRecentLogs } from '../../../src/core/log/debugLog';

/**
 * WriteJournal contract suite — plan 02-02 Task 2 (D2-25 / D2-21).
 *
 * Eleven named cases, one per contract clause: entry creation with the seven
 * pre-seeded migration stages, per-stage persistence, idempotent replay of an
 * interrupted `applying` entry and of a `pending` entry, reverse-order rollback,
 * rollback-failure logging, duplicate-operation handling by idempotency key,
 * bounded compaction, the attempt counter, strict-schema rejection, and the
 * sentinel-absence assertion over every surface the journal can reach.
 *
 * The destination is an in-memory Map and the journal store is a cloned
 * in-memory map, so every assertion is deterministic and no test depends on
 * another (D2-35).
 */

const SENTINEL = 'synthetic-body-DO-NOT-LEAK-journal-7f3a9c';

const localMap = () =>
  (globalThis as unknown as { __chromeStorageMap: Map<string, unknown> }).__chromeStorageMap;
const sessionMap = () =>
  (globalThis as unknown as { __chromeStorageSessionMap: Map<string, unknown> })
    .__chromeStorageSessionMap;

interface MemoryJournalStore extends JournalEntryStore {
  entries: Map<string, WriteJournalEntry>;
}

/** A journal store that persists a clone, so a read-back is never the argument. */
function createMemoryStore(): MemoryJournalStore {
  const entries = new Map<string, WriteJournalEntry>();
  return {
    entries,
    async load(id: string) {
      return entries.get(id);
    },
    async persist(entry: WriteJournalEntry) {
      entries.set(entry.id, structuredClone(entry));
    },
  };
}

function idempotentStep(
  name: string,
  apply: () => Promise<void> = async () => undefined,
  rollback: () => Promise<void> = async () => undefined,
): JournalStep {
  return { name, apply, rollback };
}

function entryFor(id: string, stages: readonly string[]): WriteJournalEntry {
  return buildJournalEntry({ id, operation: 'update-workspace', stageNames: stages });
}

beforeEach(() => {
  localMap().clear();
  sessionMap().clear();
  clearLogs();
});

afterEach(() => {
  localMap().clear();
  sessionMap().clear();
});

describe('WriteJournal — stage, replay, rollback, duplicates, bounds and redaction', () => {
  it('creates a migration entry with the seven D2-09 stages pre-seeded as pending', async () => {
    const store = createMemoryStore();
    const created = await createJournalEntry(
      { id: 'migrate-1', operation: 'migrate-legacy-conversations' },
      store,
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.created).toBe(true);
    expect(created.entry.status).toBe('pending');
    expect(created.entry.attempts).toBe(0);
    expect(created.entry.steps).toEqual(
      MIGRATION_STAGE_NAMES.map((name) => ({ name, status: 'pending' })),
    );

    // The stage names and the status union are the canonical ones.
    expect(MIGRATION_STAGE_NAMES).toEqual([
      'discovered',
      'validated',
      'destination-write-started',
      'destination-written',
      'destination-verified',
      'source-sanitised',
      'completed',
    ]);
    expect(WRITE_JOURNAL_STATUSES).toEqual([
      'pending',
      'applying',
      'completed',
      'failed',
      'rolled-back',
    ]);
    expect(WRITE_JOURNAL_STATUSES).toContain(created.entry.status);
  });

  it('persists the entry after every stage transition', async () => {
    const store = createMemoryStore();
    const snapshots: string[] = [];
    const persisting: JournalEntryStore = {
      load: (id) => store.load(id),
      persist: async (entry) => {
        const completed = entry.steps.filter((step) => step.status === 'completed').length;
        snapshots.push(`${entry.status}:${completed}`);
        await store.persist(entry);
      },
    };

    const entry = buildJournalEntry({ id: 'op-progress', operation: 'migrate-legacy-conversations' });
    await persisting.persist(entry);

    const steps = MIGRATION_STAGE_NAMES.map((name) => idempotentStep(name));
    await runJournaled(entry, steps, persisting.persist);

    expect(snapshots).toEqual([
      'pending:0',
      'applying:0',
      'applying:1',
      'applying:2',
      'applying:3',
      'applying:4',
      'applying:5',
      'applying:6',
      'applying:7',
      'completed:7',
    ]);
  });

  it('replays an interrupted applying entry idempotently, leaving exactly one destination record', async () => {
    const destination = new Map<string, string>();
    const store = createMemoryStore();

    // The destination write is an idempotent upsert by a deterministic key.
    const steps: JournalStep[] = [
      idempotentStep('destination-write-started'),
      idempotentStep(
        'destination-written',
        async () => {
          destination.set('session-1:1', 'message-1');
        },
        async () => {
          destination.delete('session-1:1');
        },
      ),
    ];

    // A crash left the entry mid-flight: `applying`, the write already applied.
    const interrupted = buildJournalEntry({
      id: 'session-1:1',
      operation: 'append-memory-message',
      stageNames: ['destination-write-started', 'destination-written'],
    });
    interrupted.status = 'applying';
    interrupted.attempts = 1;
    interrupted.steps = [
      { name: 'destination-write-started', status: 'completed' },
      { name: 'destination-written', status: 'pending' },
    ];
    await store.persist(interrupted);
    destination.set('session-1:1', 'message-1');

    const summary = await recoverJournal(
      async () => [...store.entries.values()],
      async (entry) => {
        await runJournaled(entry, steps, store.persist);
      },
    );

    expect(summary.replayed).toBe(1);
    expect(summary.failed).toBe(0);
    // Exactly one record — a replay is a no-op, not a duplicate (T-02-08).
    expect(destination.size).toBe(1);
    expect(store.entries.get('session-1:1')?.status).toBe('completed');
  });

  it('replays a pending entry on the next start', async () => {
    const destination = new Map<string, string>();
    const store = createMemoryStore();
    const steps: JournalStep[] = [
      idempotentStep('destination-written', async () => {
        destination.set('session-2:1', 'message-1');
      }),
    ];

    const entry = buildJournalEntry({
      id: 'session-2:1',
      operation: 'append-memory-message',
      stageNames: ['destination-written'],
    });
    await store.persist(entry);

    const summary = await recoverJournal(
      async () => [...store.entries.values()],
      async (candidate) => {
        await runJournaled(candidate, steps, store.persist);
      },
    );

    expect(summary.replayed).toBe(1);
    expect(destination.size).toBe(1);
    expect(store.entries.get('session-2:1')?.status).toBe('completed');
  });

  it('rolls back the applied steps in reverse order and lands as rolled-back', async () => {
    const order: string[] = [];
    const store = createMemoryStore();
    const entry = entryFor('op-rollback', ['a', 'b', 'c']);
    await store.persist(entry);

    const steps: JournalStep[] = [
      idempotentStep('a', async () => {
        order.push('apply-a');
      }, async () => {
        order.push('rollback-a');
      }),
      idempotentStep('b', async () => {
        order.push('apply-b');
      }, async () => {
        order.push('rollback-b');
      }),
      idempotentStep('c', async () => {
        order.push('apply-c');
        throw new Error('step c failed');
      }, async () => {
        order.push('rollback-c');
      }),
    ];

    await expect(runJournaled(entry, steps, store.persist)).rejects.toThrow('step c failed');

    // Only the applied steps roll back, newest first; the failing step does not.
    expect(order).toEqual(['apply-a', 'apply-b', 'apply-c', 'rollback-b', 'rollback-a']);

    const persisted = store.entries.get('op-rollback');
    expect(persisted?.status).toBe('rolled-back');
    expect(persisted?.steps.find((step) => step.name === 'c')?.status).toBe('failed');
    expect(persisted?.steps.find((step) => step.name === 'b')?.status).toBe('completed');
  });

  it('logs a rollback failure and never masks the original step failure', async () => {
    const store = createMemoryStore();
    const entry = entryFor('op-rollback-failed', ['a', 'b']);
    await store.persist(entry);

    const steps: JournalStep[] = [
      idempotentStep('a', async () => undefined, async () => {
        throw new Error('rollback exploded');
      }),
      idempotentStep('b', async () => {
        throw new Error('original failure');
      }),
    ];

    await expect(runJournaled(entry, steps, store.persist)).rejects.toThrow('original failure');

    const codes = getRecentLogs().map((log) => log.code);
    expect(codes).toContain('WRITE_JOURNAL_ROLLBACK_FAILED');
    expect(codes).toContain('WRITE_JOURNAL_FAILED');
    expect(store.entries.get('op-rollback-failed')?.status).toBe('rolled-back');
  });

  it('finds the existing entry for a repeated idempotency key instead of inserting a second one', async () => {
    const store = createMemoryStore();
    const input = {
      id: 'session-9:3',
      operation: 'append-memory-message' as const,
      targetIds: { sessionId: 'session-9', seq: '3' },
    };

    const first = await createJournalEntry(input, store);
    const second = await createJournalEntry(input, store);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.created).toBe(false);
    expect(second.entry.createdAt).toBe(first.entry.createdAt);
    expect(second.entry.id).toBe(first.entry.id);
    expect(store.entries.size).toBe(1);
  });

  it('compacts terminal entries to a bounded newest set and never removes a non-terminal entry', () => {
    const terminal = Array.from({ length: 60 }, (_, index) => ({
      ...buildJournalEntry({ id: `terminal-${index}`, operation: 'update-workspace' }),
      status: 'completed' as const,
      updatedAt: 1000 + index,
    }));

    const nonTerminal = [
      { ...buildJournalEntry({ id: 'pending-1', operation: 'update-workspace' }), status: 'pending' as const },
      { ...buildJournalEntry({ id: 'applying-1', operation: 'update-workspace' }), status: 'applying' as const },
    ];

    const { keep, removed } = compactJournal([...terminal, ...nonTerminal], 5);

    expect(keep.filter((entry) => entry.status === 'pending' || entry.status === 'applying')).toHaveLength(2);
    expect(keep.map((entry) => entry.id)).toContain('pending-1');
    expect(keep.map((entry) => entry.id)).toContain('applying-1');

    // The newest five terminal entries survive; the order of `keep` is the
    // caller's input order, so the assertion is over the retained set.
    const keptTerminalIds = keep
      .filter((entry) => entry.status === 'completed')
      .map((entry) => entry.id)
      .sort();
    expect(keptTerminalIds).toEqual([
      'terminal-55',
      'terminal-56',
      'terminal-57',
      'terminal-58',
      'terminal-59',
    ]);
    expect(removed).toHaveLength(55);
    expect(removed).not.toContain('pending-1');
    expect(removed).not.toContain('applying-1');
  });

  it('increments the attempt counter once per attempt', async () => {
    const store = createMemoryStore();
    const entry = entryFor('op-attempts', ['a']);

    await expect(
      runJournaled(
        entry,
        [
          idempotentStep('a', async () => {
            throw new Error('first attempt fails');
          }),
        ],
        store.persist,
      ),
    ).rejects.toThrow('first attempt fails');

    expect(entry.attempts).toBe(1);
    expect(store.entries.get('op-attempts')?.attempts).toBe(1);

    await runJournaled(entry, [idempotentStep('a')], store.persist);

    expect(entry.attempts).toBe(2);
    expect(store.entries.get('op-attempts')?.attempts).toBe(2);
    expect(store.entries.get('op-attempts')?.status).toBe('completed');
  });

  it('rejects a malformed entry with a typed result and persists nothing', async () => {
    const valid = buildJournalEntry({ id: 'op-valid', operation: 'update-workspace', stageNames: ['a'] });

    // A status outside the canonical union, and an unknown field, both fail.
    expect(parseWriteJournalEntry({ ...valid, status: 'applied' })).toEqual({
      ok: false,
      code: 'WRITE_JOURNAL_INVALID_ENTRY',
    });
    expect(parseWriteJournalEntry({ ...valid, secret: 'nope' })).toEqual({
      ok: false,
      code: 'WRITE_JOURNAL_INVALID_ENTRY',
    });
    expect(parseWriteJournalEntry({ ...valid, steps: [{ name: '', status: 'pending' }] })).toEqual({
      ok: false,
      code: 'WRITE_JOURNAL_INVALID_ENTRY',
    });
    expect(parseWriteJournalEntry(valid)).toEqual({ ok: true, entry: valid });

    const store = createMemoryStore();
    const created = await createJournalEntry(
      { id: 'op-invalid', operation: 'update-workspace', stageNames: [''] },
      store,
    );
    expect(created.ok).toBe(false);
    expect(store.entries.size).toBe(0);
  });

  it('keeps the sentinel body out of the serialised entry, the log ring buffer and both storage maps', async () => {
    const store = createMemoryStore();
    const entry = buildJournalEntry({
      id: 'session-1:1',
      operation: 'append-memory-message',
      targetIds: { sessionId: 'session-1', seq: '1' },
      stageNames: ['destination-written', 'destination-verified'],
    });

    const steps: JournalStep[] = [
      idempotentStep('destination-written', async () => {
        // The body belongs to the destination store only — never to the journal.
        localMap().set('np_store', JSON.stringify({ state: { config: {} } }));
      }),
      idempotentStep('destination-verified', async () => {
        throw new Error(SENTINEL);
      }),
    ];

    await expect(runJournaled(entry, steps, store.persist)).rejects.toThrow(SENTINEL);

    expect(JSON.stringify([...store.entries.values()])).not.toContain(SENTINEL);
    expect(JSON.stringify(getRecentLogs())).not.toContain(SENTINEL);
    expect(JSON.stringify([...localMap().entries()])).not.toContain(SENTINEL);
    expect(JSON.stringify([...sessionMap().entries()])).not.toContain(SENTINEL);

    // Every emitted code is SCREAMING_SNAKE, and none carries the value.
    const logs = getRecentLogs();
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(log.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(log.context?.reason).not.toBe(SENTINEL);
    }
  });
});
