// src/core/storage/WriteJournal.ts — Source: Appendix O.11 (lines 6598-6643,
// verbatim reference) + §20.3 update-workspace order + §15.1 WriteJournalDB
// (line 1964-1965) + D-05/D-07.
//
// The crash-safe write journal: runJournaled makes a multi-step write
// atomic-on-recovery (a mid-write crash leaves an 'applying' entry that
// recoverJournal replays on startup), recoverJournal finishes or undoes any
// entry left mid-flight, and WriteJournalDB (IndexedDB 'entries' store, §15.1)
// persists the entries. Every apply() MUST be idempotent (upsert-by-key) so a
// replay after a crash is a no-op, not a duplicate (O.11).
//
// D-05: only 'update-workspace' is wired in Phase 2; the other 10
// WriteJournalOperation values stay declared-but-unwired. D-07: the
// workspace-scoped replay gate (WR-10) and the unknown-op skip-and-log live in
// the WorkspaceStore consumer (Task 2 of this plan), NOT in recoverJournal —
// recoverJournal stays the O.11 verbatim loop. D-16: every journal persist
// routes the entry's step error / message strings through redactSensitive
// BEFORE put (R-10 — no raw prompt/secret ever lands in a journal entry).
//
// Golden Rule 9: every catch calls debugLog with a canonical §C.2 code
// (WRITE_JOURNAL_FAILED / WRITE_JOURNAL_ROLLBACK_FAILED, 02-01).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { WriteJournalEntry } from '@/types/storage';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { redactSensitive } from '@/core/security/redactSensitive';

/** A single idempotent step of a journaled write (Appendix O.11 verbatim). */
export interface JournalStep {
  name: string;
  apply(): Promise<void>; // MUST be idempotent (safe to run twice on replay)
  rollback(): Promise<void>;
}

/**
 * Run a journaled write (Appendix O.11 verbatim): mark 'applying' + bump
 * attempts and persist, apply each step (pushing a completed step marker +
 * persisting at every boundary), then mark 'completed' + persist. On a throw:
 * debugLog WRITE_JOURNAL_FAILED, reverse-rollback the completed steps (each
 * individually wrapped — a rollback throw is logged as
 * WRITE_JOURNAL_ROLLBACK_FAILED and does NOT mask the original error or abort
 * the remaining rollbacks), mark 'rolled-back' + persist, and rethrow.
 */
export async function runJournaled(
  entry: WriteJournalEntry,
  steps: JournalStep[],
  persist: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  entry.status = 'applying';
  entry.attempts++;
  await persist(entry);
  const done: JournalStep[] = [];
  try {
    for (const s of steps) {
      await s.apply();
      entry.steps.push({ name: s.name, status: 'completed' });
      done.push(s);
      await persist(entry);
    }
    entry.status = 'completed';
    await persist(entry);
  } catch (e: unknown) {
    debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'rolling back', {
      extra: { id: entry.id, step: done.at(-1)?.name },
    });
    for (const s of done.reverse()) {
      try {
        await s.rollback();
      } catch (r: unknown) {
        debugLog(
          ERROR_CODES.WRITE_JOURNAL_ROLLBACK_FAILED,
          r instanceof Error ? r.message : 'rollback',
          {
            extra: { id: entry.id },
          },
        );
      }
    }
    entry.status = 'rolled-back';
    try {
      await persist(entry);
    } catch (p) {
      // WR-03: a failure to persist the 'rolled-back' marker is logged and
      // swallowed — the original error already propagated; masking it with a
      // persist failure would lose the real cause. The entry stays 'applying'
      // on disk, so recovery re-attempts the replay (idempotent).
      debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'failed to persist rolled-back entry', {
        error: p instanceof Error ? p : undefined,
        module: 'WriteJournal',
      });
    }
    throw e;
  }
}

/**
 * On startup: finish or undo any entry left mid-flight (O.11 verbatim). Only
 * 'pending'/'applying' entries are replayed — completed/rolled-back/failed are
 * terminal. The workspace-scoped gate + unknown-op skip are the CONSUMER's
 * replay contract (D-07, WorkspaceStore Task 2), not this loop's.
 */
export async function recoverJournal(
  load: () => Promise<WriteJournalEntry[]>,
  replay: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  for (const e of await load()) {
    if (e.status === 'applying' || e.status === 'pending') await replay(e); // idempotent replay
  }
}

/** §15.1 WriteJournalDB — single 'entries' object store keyed by entry id. */
export interface WriteJournalDBSchema extends DBSchema {
  entries: { key: string; value: WriteJournalEntry };
}

const WRITE_JOURNAL_DB_NAME = 'WriteJournalDB';
const WRITE_JOURNAL_DB_VERSION = 1;

/** Open (creating on first use) the WriteJournalDB entries store (§15.1 line 1964). */
export async function openWriteJournalDB(): Promise<IDBPDatabase<WriteJournalDBSchema>> {
  return openDB<WriteJournalDBSchema>(WRITE_JOURNAL_DB_NAME, WRITE_JOURNAL_DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('entries', { keyPath: 'id' });
    },
  });
}

/**
 * Persist a journal entry — the D-16 write-boundary hook: the entry's step
 * error / message strings run through redactSensitive BEFORE put (R-10,
 * T-2-04-04). WR-03: unlike the old swallow-and-resolve, a persist failure is
 * RETHROWN after logging so runJournaled ABORTS (and rolls back) when the
 * journal itself cannot be written — journal atomicity must not silently void
 * (O.11 depends on durable persist). Golden Rule 9 still holds: debugLog
 * runs before the throw.
 */
export async function persistJournalEntry(e: WriteJournalEntry): Promise<void> {
  try {
    const db = await openWriteJournalDB();
    const safe = redactSensitive(e) as WriteJournalEntry;
    await db.put('entries', safe);
  } catch (err) {
    debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'journal persist failed', {
      error: err instanceof Error ? err : undefined,
      module: 'WriteJournal',
    });
    throw err;
  }
}

/** Load ALL journal entries from the entries store (recoverJournal filters by status). */
export async function loadPendingEntries(): Promise<WriteJournalEntry[]> {
  try {
    const db = await openWriteJournalDB();
    return await db.getAll('entries');
  } catch (err) {
    debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'journal load failed', {
      error: err instanceof Error ? err : undefined,
      module: 'WriteJournal',
    });
    return [];
  }
}
