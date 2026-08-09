// tests/core/storage/WriteJournal.test.ts — STORAGE-04 WriteJournal contract
// tests (Appendix O.11 + D-05/D-07): runJournaled happy-path and rollback
// semantics, recoverJournal replay-once for pending/applying entries only,
// unknown-op skip-and-log (D-07 forward-compat), workspace-scoped replay skip
// (WR-10/D-07), and the WriteJournalDB persist-boundary redaction hook
// (D-16 / T-2-04-04). Uses the buildJournalRecoveryFixture builder from 02-01
// (D-20/21: the SAME deterministic builder the WorkspacePersistence integration
// test imports). Runs in the default jsdom-align environment with a fresh
// IDBFactory per test (RESEARCH Pattern 8).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { buildJournalRecoveryFixture } from '../../fixtures/index';
import {
  loadPendingEntries,
  persistJournalEntry,
  recoverJournal,
  runJournaled,
  type JournalStep,
} from '@/core/storage/WriteJournal';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { WriteJournalEntry } from '@/types/storage';

function makeEntry(overrides: Partial<WriteJournalEntry> = {}): WriteJournalEntry {
  return {
    id: 'entry-1',
    operation: 'update-workspace',
    status: 'pending',
    createdAt: 1000,
    updatedAt: 1000,
    attempts: 0,
    targetIds: { workspaceId: 'ws-fixture-01', version: '5' },
    steps: [],
    ...overrides,
  };
}

function makeStep(name: string): JournalStep {
  return {
    name,
    apply: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
  };
}

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  indexedDB = new IDBFactory(); // RESEARCH Pattern 8: fresh IndexedDB per test
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe('runJournaled — O.11 happy path and rollback', () => {
  it('transitions pending → applying → completed, persisting at every boundary', async () => {
    const entry = makeEntry();
    const statuses: string[] = [];
    const persist = vi.fn(async (e: WriteJournalEntry) => {
      statuses.push(e.status);
    });
    const steps = [makeStep('write-np-workspace'), makeStep('emit-workspace-updated')];

    await runJournaled(entry, steps, persist);

    expect(entry.status).toBe('completed');
    expect(entry.attempts).toBe(1);
    expect(entry.steps).toEqual([
      { name: 'write-np-workspace', status: 'completed' },
      { name: 'emit-workspace-updated', status: 'completed' },
    ]);
    // persists: applying (boundary) → per-step → completed (boundary)
    expect(statuses[0]).toBe('applying');
    expect(statuses[statuses.length - 1]).toBe('completed');
    expect(persist).toHaveBeenCalledTimes(1 + steps.length + 1);
  });

  it('rolls back completed steps in reverse and marks the entry rolled-back on a step throw', async () => {
    const entry = makeEntry();
    const persist = vi.fn(async () => {});
    const step1 = makeStep('write-np-workspace');
    const step2 = makeStep('emit-workspace-updated');
    (step2.apply as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));

    await expect(runJournaled(entry, [step1, step2], persist)).rejects.toThrow('boom');

    expect(step1.rollback).toHaveBeenCalledTimes(1);
    expect(step2.rollback).not.toHaveBeenCalled(); // failed step never ran
    expect(entry.status).toBe('rolled-back');
    // WRITE_JOURNAL_FAILED logged (Golden Rule 9) and the original error rethrown
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(ERROR_CODES.WRITE_JOURNAL_FAILED),
      expect.anything(),
      expect.anything(),
    );
  });

  it('a failing rollback is logged as WRITE_JOURNAL_ROLLBACK_FAILED and does not mask the original error', async () => {
    const entry = makeEntry();
    const persist = vi.fn(async () => {});
    const step1 = makeStep('write-np-workspace');
    (step1.rollback as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('rollback broke'));
    const step2 = makeStep('emit-workspace-updated');
    (step2.apply as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));

    await expect(runJournaled(entry, [step1, step2], persist)).rejects.toThrow('boom');

    expect(entry.status).toBe('rolled-back');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(ERROR_CODES.WRITE_JOURNAL_ROLLBACK_FAILED),
      expect.anything(),
      expect.anything(),
    );
  });

  it('aborts (rejects) when the journal itself cannot be persisted — no step ever runs (WR-03)', async () => {
    const entry = makeEntry();
    const persist = vi.fn(async () => {
      throw new Error('idb unavailable');
    });
    const step = makeStep('write-np-workspace');

    await expect(runJournaled(entry, [step], persist)).rejects.toThrow('idb unavailable');

    // The journal never became durable → the write must NOT proceed. (The
    // 'applying' boundary persist sits OUTSIDE the try per Appendix O.11
    // verbatim, so the rejection propagates directly — nothing was logged.)
    expect(step.apply).not.toHaveBeenCalled();
    expect(step.rollback).not.toHaveBeenCalled();
    expect(entry.status).toBe('applying');
  });

  it('a failure to persist the rolled-back marker is logged but never masks the original error (WR-03)', async () => {
    const entry = makeEntry();
    let persistCalls = 0;
    const persist = vi.fn(async () => {
      persistCalls++;
      if (persistCalls >= 2) throw new Error('persist broken'); // the rolled-back persist
    });
    const step = makeStep('write-np-workspace');
    (step.apply as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));

    await expect(runJournaled(entry, [step], persist)).rejects.toThrow('boom');

    // The ORIGINAL error surfaces — not the persist failure — and the failed
    // rolled-back persist was logged (message in the first arg, cause in the
    // second), never swallowed silently.
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed to persist rolled-back entry'),
      expect.stringContaining('persist broken'),
      expect.anything(),
    );
  });
});

describe('recoverJournal — O.11 replay', () => {
  it('replays only pending/applying entries, each once, and skips completed ones', async () => {
    const fixture = buildJournalRecoveryFixture();
    // completed + pending subset — the plan's case 3 shape
    const entries = [fixture.entries[0], fixture.entries[2]];
    const replayed: string[] = [];
    const replay = vi.fn(async (e: WriteJournalEntry) => {
      replayed.push(e.id);
      e.status = 'completed'; // consumer finalizes the entry (replay-once)
    });

    await recoverJournal(() => Promise.resolve(entries), replay);
    await recoverJournal(() => Promise.resolve(entries), replay); // second pass

    expect(replayed).toEqual(['jrn-pending']); // completed never replayed, pending once
  });

  it('skips an unknown-operation entry with a debugLog and never throws (D-07 forward-compat)', async () => {
    const fixture = buildJournalRecoveryFixture();
    const unknownOp = fixture.entries[4]; // 'jrn-unknown-op' — operation not in the wired set
    const applied: string[] = [];
    const gatedReplay = async (e: WriteJournalEntry): Promise<void> => {
      if (e.operation !== 'update-workspace') {
        debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'replay skipped (unknown operation)', {
          silent: true,
          module: 'WriteJournal.test',
        });
        return;
      }
      applied.push(e.id);
    };

    await expect(
      recoverJournal(() => Promise.resolve([unknownOp]), gatedReplay),
    ).resolves.toBeUndefined();

    expect(applied).toEqual([]); // skipped, never applied
  });

  it('skips an entry whose targetIds.workspaceId is foreign (WR-10 / D-07 workspace scope)', async () => {
    const fixture = buildJournalRecoveryFixture();
    const foreign = fixture.entries[3]; // 'jrn-other-workspace' — targetIds workspaceId 'ws-other'
    const applied: string[] = [];
    const gatedReplay = async (e: WriteJournalEntry): Promise<void> => {
      if (e.targetIds?.workspaceId !== fixture.workspaceId) {
        debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'replay skipped (foreign workspace)', {
          silent: true,
          module: 'WriteJournal.test',
        });
        return;
      }
      applied.push(e.id);
    };

    await expect(
      recoverJournal(() => Promise.resolve([foreign]), gatedReplay),
    ).resolves.toBeUndefined();

    expect(applied).toEqual([]); // workspace-scoped skip
  });
});

describe('WriteJournalDB — entries store persist + load', () => {
  it('persistJournalEntry stores a completed update-workspace entry and loadPendingEntries returns it', async () => {
    const entry = makeEntry({ id: 'persist-1', status: 'completed' });
    await persistJournalEntry(entry);

    const loaded = await loadPendingEntries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(entry);
  });

  it('redacts step error strings through redactSensitive BEFORE put (D-16 / T-2-04-04)', async () => {
    const entry = makeEntry({
      id: 'redact-1',
      status: 'rolled-back',
      steps: [
        { name: 'write-np-workspace', status: 'failed', error: 'auth failed for sk-abc123def456' },
      ],
    });
    await persistJournalEntry(entry);

    const loaded = await loadPendingEntries();
    expect(loaded[0].steps[0].error).toContain('[REDACTED]');
    expect(loaded[0].steps[0].error).not.toContain('sk-abc123def456');
  });
});
