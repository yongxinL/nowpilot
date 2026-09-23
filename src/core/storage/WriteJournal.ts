import { z } from 'zod';
import { debugLog } from '../log/debugLog';

/**
 * WriteJournal — the crash-safe multi-step write log (Appendix O.11, §20.3).
 *
 * Notes and memory span two persistence systems (metadata in
 * `chrome.storage.local`, bodies in IndexedDB). The journal makes such a write
 * **atomic-on-recovery**: on startup every `pending` / `applying` entry is
 * replayed (idempotently) or rolled back. It never claims one shared
 * transaction across the two systems — that claim is forbidden (D2-09).
 *
 * **Two recorded divergences from the Appendix O.11 reference:**
 *
 *   1. **All stage names are pre-seeded as `pending` at entry creation** and
 *      flipped to `completed` as each runs, instead of O.11's push-completed
 *      list. D2-09's restart-safe stages and D2-12's "retain the journal stage
 *      showing destination verified" both require a restart to distinguish
 *      *"stage not reached"* from *"stage reached"* — a push-only list cannot.
 *   2. **`'migrate-legacy-conversations'` is added to the canonical
 *      `WriteJournalOperation` union** (additively — no member is renamed).
 *      §20.3's union is closed and contains no migration operation, while
 *      D2-09/D2-10 require the legacy migration to be journaled. This is a
 *      **spec follow-up with an owner** in the D2-29 pattern; `PRODUCT_SPEC.md`
 *      is deliberately not edited during Phase 2.
 *
 * **Redaction by construction.** A journal entry may carry only operation
 * metadata and safe identifiers (`targetIds`): never a message body, credential
 * plaintext, ciphertext, salt, IV, page content, hidden reasoning or a whole
 * `WorkspaceState` (D2-21). Every entry is validated by the strict schema below
 * at the write boundary, and every `catch` logs a `SCREAMING_SNAKE` code with a
 * reason that is never a value.
 */

/** The canonical §20.3 operation union plus the additive migration member. */
export const WRITE_JOURNAL_OPERATIONS = [
  'append-memory-message',
  'evict-conversation',
  'archive-conversation',
  'compact-conversation',
  'save-note-with-links',
  'update-user-memory',
  'export-data',
  'update-workspace',
  'sync-note-file',
  'delete-note-file',
  'restore-notes-batch',
  // Additive: the §20.3 union has no migration member (see the module note).
  'migrate-legacy-conversations',
] as const;

export type WriteJournalOperation = (typeof WRITE_JOURNAL_OPERATIONS)[number];

/** The canonical Appendix C status union — the migration stages are not statuses. */
export const WRITE_JOURNAL_STATUSES = [
  'pending',
  'applying',
  'completed',
  'failed',
  'rolled-back',
] as const;

export type WriteJournalStatus = (typeof WRITE_JOURNAL_STATUSES)[number];

export type JournalStepStatus = 'pending' | 'completed' | 'failed';

export interface JournalStepRecord {
  name: string;
  status: JournalStepStatus;
  /** A redacted `SCREAMING_SNAKE` code — never an exception message. */
  error?: string;
}

/** The canonical Appendix C `WriteJournalEntry` shape. */
export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: WriteJournalStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  steps: JournalStepRecord[];
}

/**
 * The seven D2-09 migration stage names. This is the single declaration of the
 * list; the legacy-migration plan re-exports it rather than restating it.
 */
export const MIGRATION_STAGE_NAMES = [
  'discovered',
  'validated',
  'destination-write-started',
  'destination-written',
  'destination-verified',
  'source-sanitised',
  'completed',
] as const;

/** The bounded terminal-entry set `compactJournal` keeps (D2-21 "bounded"). */
export const JOURNAL_TERMINAL_ENTRY_LIMIT = 50;

const INVALID_ENTRY_CODE = 'WRITE_JOURNAL_INVALID_ENTRY';
const WRITE_FAILED_CODE = 'WRITE_JOURNAL_FAILED';
const ROLLBACK_FAILED_CODE = 'WRITE_JOURNAL_ROLLBACK_FAILED';
const STEP_FAILED_CODE = 'WRITE_JOURNAL_STEP_FAILED';
const RECOVERY_FAILED_CODE = 'WRITE_JOURNAL_RECOVERY_FAILED';

export const journalStepRecordSchema = z
  .object({
    name: z.string().min(1),
    status: z.enum(['pending', 'completed', 'failed']),
    error: z.string().min(1).optional(),
  })
  .strict();

/** The strict entry schema — an unknown field is a typed failure, never accepted data. */
export const writeJournalEntrySchema = z
  .object({
    id: z.string().min(1),
    operation: z.enum(WRITE_JOURNAL_OPERATIONS),
    status: z.enum(WRITE_JOURNAL_STATUSES),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    attempts: z.number().int().nonnegative(),
    targetIds: z.record(z.string(), z.string()),
    steps: z.array(journalStepRecordSchema),
  })
  .strict();

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/** Validate a candidate entry at the write boundary. */
export function parseWriteJournalEntry(
  candidate: unknown,
): { ok: true; entry: WriteJournalEntry } | { ok: false; code: string } {
  const parsed = writeJournalEntrySchema.safeParse(candidate);
  if (!parsed.success) {
    debugLog(INVALID_ENTRY_CODE, 'Write journal entry rejected by the strict schema', {
      issueCount: parsed.error.issues.length,
    });
    return { ok: false, code: INVALID_ENTRY_CODE };
  }
  return { ok: true, entry: parsed.data };
}

/** The persistence seam: `createJournalEntry` needs to find an existing entry. */
export interface JournalEntryStore {
  load(id: string): Promise<WriteJournalEntry | undefined>;
  persist(entry: WriteJournalEntry): Promise<void>;
}

export interface CreateJournalEntryInput {
  /** The §20.2 idempotency key (`sessionId + seq`, `workspaceId + version`, …). */
  id: string;
  operation: WriteJournalOperation;
  /** Safe record identifiers only — never a body, secret or whole state object. */
  targetIds?: Record<string, string>;
  /**
   * Stage names to pre-seed as `pending`. Defaults to the seven D2-09 migration
   * stages for `'migrate-legacy-conversations'`, and to none otherwise.
   */
  stageNames?: readonly string[];
  now?: number;
}

/** Build an entry with every stage pre-seeded as `pending` (see the module note). */
export function buildJournalEntry(input: CreateJournalEntryInput): WriteJournalEntry {
  const now = input.now ?? Date.now();
  const stageNames =
    input.stageNames ??
    (input.operation === 'migrate-legacy-conversations' ? MIGRATION_STAGE_NAMES : []);

  return {
    id: input.id,
    operation: input.operation,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    targetIds: { ...(input.targetIds ?? {}) },
    steps: stageNames.map((name) => ({ name, status: 'pending' as const })),
  };
}

/**
 * Create the entry for an operation, or return the existing one.
 *
 * §20.2/D2-14 duplicate handling: the idempotency key is looked up **first**, so
 * a repeated operation finds its entry rather than inserting a second one.
 */
export async function createJournalEntry(
  input: CreateJournalEntryInput,
  store: JournalEntryStore,
): Promise<{ ok: true; entry: WriteJournalEntry; created: boolean } | { ok: false; code: string }> {
  const existing = await store.load(input.id);
  if (existing) {
    return { ok: true, entry: existing, created: false };
  }

  const parsed = parseWriteJournalEntry(buildJournalEntry(input));
  if (!parsed.ok) return parsed;

  await store.persist(parsed.entry);
  return { ok: true, entry: parsed.entry, created: true };
}

/** The Appendix O.11 step contract. `apply` MUST be idempotent (upsert by key). */
export interface JournalStep {
  name: string;
  apply(): Promise<void>;
  rollback(): Promise<void>;
}

export interface RunJournaledOptions {
  /** Deterministic clock seam. */
  now?: () => number;
}

function markStep(
  entry: WriteJournalEntry,
  name: string,
  status: JournalStepStatus,
  error?: string,
): void {
  const existing = entry.steps.find((step) => step.name === name);
  if (!existing) {
    entry.steps.push(error ? { name, status, error } : { name, status });
    return;
  }
  existing.status = status;
  if (error) {
    existing.error = error;
  } else {
    delete existing.error;
  }
}

/**
 * Run a staged write: `pending` → `applying` → per-step `completed` →
 * `completed`, persisting the entry after **every** transition so a crash is
 * distinguishable from "not reached".
 *
 * On a step failure the applied steps are rolled back in reverse order, the
 * entry is persisted as `rolled-back`, and the original error is rethrown. A
 * rollback failure is logged and never masks the original failure.
 */
export async function runJournaled(
  entry: WriteJournalEntry,
  steps: readonly JournalStep[],
  persist: (entry: WriteJournalEntry) => Promise<void>,
  options: RunJournaledOptions = {},
): Promise<void> {
  const now = options.now ?? Date.now;

  entry.status = 'applying';
  entry.attempts += 1;
  entry.updatedAt = now();
  await persist(entry);

  const applied: JournalStep[] = [];

  try {
    for (const step of steps) {
      // Idempotent by contract, so a replay after a crash is a no-op rather
      // than a duplicate (D2-14).
      await step.apply();
      markStep(entry, step.name, 'completed');
      applied.push(step);
      entry.updatedAt = now();
      await persist(entry);
    }

    entry.status = 'completed';
    entry.updatedAt = now();
    await persist(entry);
  } catch (error) {
    debugLog(WRITE_FAILED_CODE, 'Journaled write failed; rolling back the applied steps', {
      id: entry.id,
      step: applied.at(-1)?.name ?? steps[0]?.name ?? 'none',
      reason: errorName(error),
    });

    const failingStep = steps[applied.length];
    if (failingStep) {
      markStep(entry, failingStep.name, 'failed', STEP_FAILED_CODE);
    }

    for (const step of [...applied].reverse()) {
      try {
        await step.rollback();
      } catch (rollbackError) {
        // Never masks the original failure: the entry still lands as
        // `rolled-back` and the original error is what the caller receives.
        debugLog(ROLLBACK_FAILED_CODE, 'Journal step rollback failed', {
          id: entry.id,
          step: step.name,
          reason: errorName(rollbackError),
        });
      }
    }

    entry.status = 'rolled-back';
    entry.updatedAt = now();
    await persist(entry);
    throw error;
  }
}

/**
 * On startup: finish every entry left mid-flight by a crash (Appendix O.11).
 *
 * `replay` receives each `pending` / `applying` entry and is responsible for
 * finishing it — typically by calling `runJournaled` again with the same
 * idempotent steps. A replay failure leaves the entry non-terminal (so the next
 * start retries it), is logged redacted, and never stops the remaining entries.
 */
export async function recoverJournal(
  load: () => Promise<WriteJournalEntry[]>,
  replay: (entry: WriteJournalEntry) => Promise<void>,
): Promise<{ replayed: number; failed: number }> {
  let replayed = 0;
  let failed = 0;

  for (const candidate of await load()) {
    const parsed = parseWriteJournalEntry(candidate);
    if (!parsed.ok) {
      failed += 1;
      continue;
    }

    const entry = parsed.entry;
    if (entry.status !== 'pending' && entry.status !== 'applying') continue;

    try {
      await replay(entry);
      replayed += 1;
    } catch (error) {
      failed += 1;
      debugLog(
        RECOVERY_FAILED_CODE,
        'Journal replay failed; the entry stays non-terminal for the next start',
        { id: entry.id, status: entry.status, reason: errorName(error) },
      );
    }
  }

  return { replayed, failed };
}

/**
 * Bound the journal: keep **every** non-terminal entry plus the newest
 * `terminalLimit` terminal entries (D2-21 "bounded cleanup or compaction").
 *
 * Pure — the caller deletes the returned `removed` ids from the store. A
 * non-terminal entry is never removed.
 */
export function compactJournal(
  entries: readonly WriteJournalEntry[],
  terminalLimit: number = JOURNAL_TERMINAL_ENTRY_LIMIT,
): { keep: WriteJournalEntry[]; removed: string[] } {
  const nonTerminal = entries.filter(
    (entry) => entry.status === 'pending' || entry.status === 'applying',
  );
  const terminal = entries.filter(
    (entry) => entry.status !== 'pending' && entry.status !== 'applying',
  );

  const newestTerminal = [...terminal]
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, terminalLimit));

  const keepIds = new Set([...nonTerminal, ...newestTerminal].map((entry) => entry.id));

  return {
    keep: entries.filter((entry) => keepIds.has(entry.id)),
    removed: entries.filter((entry) => !keepIds.has(entry.id)).map((entry) => entry.id),
  };
}
