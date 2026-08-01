import { openDB, type IDBPDatabase } from 'idb';

// ── Types ────────────────────────────────────────────────────────────────────

export type WriteJournalOperation =
  | 'update-workspace'
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'write-preference'
  | 'export-data';

export type WriteJournalStatus = 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';

export interface WriteJournalStep {
  name: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: WriteJournalStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  steps: WriteJournalStep[];
}

export interface StoredStep {
  name: string;
  executor?: () => Promise<void>;
}

// ── Database helpers ─────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB('WriteJournalDB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entries')) {
          const store = db.createObjectStore('entries', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Reset the internal DB connection and delete the database.
 * Used by tests to ensure isolation between test cases.
 */
export async function resetJournalDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('WriteJournalDB');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      // Force close and retry
      resolve();
    };
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new journal entry with 'pending' status and persist it.
 */
export async function createEntry(
  operation: WriteJournalOperation,
  targetIds: Record<string, string>,
  steps: Array<{ name: string; executor: () => Promise<void> }>,
): Promise<WriteJournalEntry> {
  const entry: WriteJournalEntry = {
    id: crypto.randomUUID(),
    operation,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
    targetIds,
    steps: steps.map((s) => ({
      name: s.name,
      status: 'pending' as const,
    })),
  };

  const db = await getDb();
  await db.put('entries', entry);
  return entry;
}

/**
 * Commit a journal entry: transition through pending→applying→completed,
 * executing each step sequentially.
 */
export async function commitEntry(
  entryId: string,
  steps: Array<{ name: string; executor: () => Promise<void> }>,
): Promise<void> {
  const db = await getDb();
  const entry: WriteJournalEntry = await db.get('entries', entryId);
  if (!entry) {
    throw new Error(`Entry ${entryId} not found`);
  }

  // Mark as applying
  entry.status = 'applying';
  entry.attempts++;
  entry.updatedAt = Date.now();
  await db.put('entries', entry);

  // Execute each step
  for (let i = 0; i < entry.steps.length; i++) {
    const step = entry.steps[i];
    const stepExecutor = steps.find((s) => s.name === step.name)?.executor;
    if (stepExecutor) {
      try {
        await stepExecutor();
        step.status = 'completed';
      } catch (err) {
        step.status = 'failed';
        step.error = err instanceof Error ? err.message : String(err);
        entry.status = 'failed';
        entry.updatedAt = Date.now();
        await db.put('entries', entry);
        return;
      }
    } else {
      // A missing executor means the operation was never applied — marking
      // it completed would record silent data loss with a terminal journal
      // record that replay/repair never revisits (WR-06). Fail the step
      // (and the entry) so the record is truthful.
      step.status = 'failed';
      step.error = `No executor registered for step "${step.name}"`;
      entry.status = 'failed';
      entry.updatedAt = Date.now();
      await db.put('entries', entry);
      return;
    }
  }

  // All steps completed
  entry.status = 'completed';
  entry.updatedAt = Date.now();
  await db.put('entries', entry);
}

/**
 * Replay all non-terminal entries on startup.
 * Returns the count of entries that were replayed.
 */
export async function replayJournal(
  stepExecutors: Map<string, () => Promise<void>>,
): Promise<number> {
  const db = await getDb();
  const allEntries: WriteJournalEntry[] = await db.getAll('entries');
  const nonTerminal = allEntries.filter(
    (e) => !['completed', 'failed', 'rolled-back'].includes(e.status),
  );

  for (const entry of nonTerminal) {
    entry.status = 'applying';
    entry.attempts++;
    entry.updatedAt = Date.now();
    await db.put('entries', entry);

    // Execute incomplete steps
    try {
      for (const step of entry.steps) {
        if (step.status !== 'completed') {
          const executor = stepExecutors.get(step.name);
          if (!executor) {
            // Missing executor: the operation was never applied — fail the
            // step instead of silently marking it completed (WR-06).
            throw new Error(`No executor registered for step "${step.name}"`);
          }
          await executor();
          step.status = 'completed';
        }
      }
      entry.status = 'completed';
    } catch (err) {
      entry.status = 'failed';
      const failedStep = entry.steps.find((s) => s.status !== 'completed');
      if (failedStep) {
        failedStep.status = 'failed';
        failedStep.error = err instanceof Error ? err.message : String(err);
      }
    }
    entry.updatedAt = Date.now();
    await db.put('entries', entry);
  }

  return nonTerminal.length;
}

/**
 * Lazy repair: validate and replay a single entry's incomplete steps.
 */
export async function repairEntry(
  entryId: string,
  stepExecutors: Map<string, () => Promise<void>>,
): Promise<void> {
  const db = await getDb();
  const entry: WriteJournalEntry = await db.get('entries', entryId);
  if (!entry) {
    throw new Error(`Entry ${entryId} not found`);
  }

  // Skip terminal entries
  if (['completed', 'failed', 'rolled-back'].includes(entry.status)) {
    return;
  }

  entry.status = 'applying';
  entry.attempts++;
  entry.updatedAt = Date.now();
  await db.put('entries', entry);

  try {
    for (const step of entry.steps) {
      if (step.status !== 'completed') {
        const executor = stepExecutors.get(step.name);
        if (!executor) {
          // Missing executor: the operation was never applied — fail the
          // step instead of silently marking it completed (WR-06).
          throw new Error(`No executor registered for step "${step.name}"`);
        }
        await executor();
        step.status = 'completed';
      }
    }
    entry.status = 'completed';
  } catch (err) {
    entry.status = 'failed';
    const failedStep = entry.steps.find((s) => s.status !== 'completed');
    if (failedStep) {
      failedStep.status = 'failed';
      failedStep.error = err instanceof Error ? err.message : String(err);
    }
  }
  entry.updatedAt = Date.now();
  await db.put('entries', entry);
}

/**
 * Get all entries with a given status.
 */
export async function getEntriesByStatus(
  status: WriteJournalStatus,
): Promise<WriteJournalEntry[]> {
  const db = await getDb();
  const allEntries: WriteJournalEntry[] = await db.getAll('entries');
  return allEntries.filter((e) => e.status === status);
}

/**
 * Get a single entry by ID.
 */
export async function getEntry(
  id: string,
): Promise<WriteJournalEntry | undefined> {
  const db = await getDb();
  return db.get('entries', id);
}
