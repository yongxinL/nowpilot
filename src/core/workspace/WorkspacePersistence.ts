import { z } from 'zod';
import { debugLog } from '../log/debugLog';
import { publish, subscribe } from '../runtime/BroadcastBus';
import { getDb } from '../storage/NowPilotDB';
import {
  createJournalEntry,
  runJournaled,
  type JournalEntryStore,
  type JournalStep,
  type WriteJournalEntry,
} from '../storage/WriteJournal';
import { chromeStorageAdapter } from '../theme/chromeStorageAdapter';
import {
  CONVERSATION_ID_MAX_CHARS,
  WORKSPACE_ID_MAX_CHARS,
  createInitialWorkspaceState,
  migrateWorkspaceState,
  parseWorkspaceState,
  type WorkspaceState,
} from './WorkspaceState';

/**
 * WorkspacePersistence — the durable `WorkspaceState` repository (D2-31, §20.3).
 *
 * ## The key and the channel
 *
 * The state lives under `WORKSPACE_STORAGE_KEY` (§15.1) and every write goes
 * through the existing debounced `chromeStorageAdapter` — the correct choice
 * for this key (RESEARCH Pattern 6 / Pitfall 1: only the *election* record must
 * bypass the debounce). The adapter's read-through pending map is what makes a
 * rapid sequence of writes order correctly, and `flushPendingWrites()` is the
 * lifecycle hook that lands the final ≤300 ms on tab close.
 *
 * ## §20.3's order, journaled
 *
 * `writeWorkspaceState` follows the pinned order exactly: create the journal
 * entry (`'update-workspace'`, idempotency key `workspaceId + version`) → write
 * the key → emit the update signal → mark the entry `completed`. The journal
 * entry is persisted through `np_db`'s `entries` store, so a crash mid-write
 * leaves a resumable record rather than an invisible half-write.
 *
 * ## Last-write-wins by integer version (Appendix M.3)
 *
 * A write whose `version` is not **strictly greater** than the stored `version`
 * is rejected and leaves the stored value byte-identical: ordering is by the
 * integer counter, never by arrival order and never by an `updatedAt`
 * comparison. A tie is therefore resolved by the stored version.
 *
 * ## The broadcast payload is two identifiers, never a state object
 *
 * Appendix M.3's reference broadcast the whole state on `WORKSPACE_UPDATED`.
 * That is superseded: the strict canonical validator and D2-31 require the
 * narrow envelope `{ workspaceId, conversationId }` only. A subscriber
 * re-reads the key and applies last-write-wins by version itself — so a stale
 * or forged payload can never install a state object, and no credential, body
 * or note content can cross the channel by construction.
 *
 * Every value is validated at the boundary (`parseWorkspaceState` for the
 * state, the strict signal schema for the payload) and every failure resolves
 * a typed result — this module never throws for an expected runtime failure.
 * Logging is `SCREAMING_SNAKE` codes only, with safe identifiers in context.
 */

/** The §15.1 key. Written through the debounced adapter (see the module note). */
export const WORKSPACE_STORAGE_KEY = 'np_workspace';

/** The cross-surface channel the update signal is published on (§20.3 step 3). */
export const WORKSPACE_CHANNEL = 'np_workspace';

/**
 * The two §20.3 stages of an `update-workspace` write, pre-seeded as `pending`
 * at entry creation (02-02's restart-safe journal convention): a restart can
 * then distinguish "the key was not written yet" from "the signal was not
 * emitted yet".
 */
export const WORKSPACE_WRITE_STAGE_NAMES = [
  'write-np-workspace',
  'emit-workspace-updated',
] as const;

/** Why a workspace read or write could not produce a usable result. */
export type WorkspacePersistenceErrorCode =
  | 'WORKSPACE_STATE_INVALID'
  | 'WORKSPACE_READ_FAILED'
  | 'WORKSPACE_VERSION_REJECTED'
  | 'WORKSPACE_WRITE_FAILED'
  | 'WORKSPACE_JOURNAL_FAILED';

export type WorkspaceReadResult =
  | { ok: true; value: WorkspaceState }
  | { ok: false; code: WorkspacePersistenceErrorCode };

export type WorkspaceWriteResult =
  | { ok: true; value: WorkspaceState }
  | { ok: false; code: WorkspacePersistenceErrorCode };

/** The narrow update signal — exactly two identifiers, never a state object. */
export interface WorkspaceUpdateSignal {
  workspaceId: string;
  conversationId: string | null;
}

/**
 * The strict signal schema. `.strict()` is load-bearing twice: a whole
 * `WorkspaceState` broadcast fails validation on receipt, and the module can
 * never publish a payload with an extra field.
 */
export const workspaceUpdateSignalSchema = z
  .object({
    workspaceId: z.string().min(1).max(WORKSPACE_ID_MAX_CHARS),
    conversationId: z.string().min(1).max(CONVERSATION_ID_MAX_CHARS).nullable(),
  })
  .strict();

/**
 * The minimal storage surface this module needs. `chromeStorageAdapter`
 * satisfies it structurally — its `StateStorage` contract permits a
 * synchronous return, so both forms are accepted here; a test injects a
 * Map-backed fake.
 */
export interface WorkspaceStorageArea {
  getItem(name: string): Promise<string | null> | string | null;
  /** `StateStorage` types the write's return as `unknown`; the caller awaits it. */
  setItem(name: string, value: string): unknown;
}

export interface WorkspacePersistenceDeps {
  /** Production default: the debounced `chromeStorageAdapter`. */
  storage?: WorkspaceStorageArea;
  /** Production default: the `entries` object store of `np_db`. */
  journal?: JournalEntryStore;
  /** Production default: `BroadcastBus.publish` on `WORKSPACE_CHANNEL`. */
  publishUpdate?(signal: WorkspaceUpdateSignal): void;
  /** Deterministic clock seam. */
  now?(): number;
}

function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The persisted representation is a JSON string. A value that cannot be parsed
 * is passed through so the throw-free migration resolves the safe base state
 * rather than this module inventing one.
 */
function parseStoredValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

/** The persisted shape version, read defensively before the migration runs. */
function persistedSchemaVersion(stored: unknown): number {
  if (isPlainObject(stored) && typeof stored.schemaVersion === 'number') {
    return stored.schemaVersion;
  }
  return 0;
}

/** The §20.2 idempotency key for `update-workspace`. */
function workspaceJournalId(state: WorkspaceState): string {
  return `${state.workspaceId}:${state.version}`;
}

/** The journal store backed by the `entries` object store of `np_db`. */
const defaultJournalStore: JournalEntryStore = {
  async load(id) {
    const db = await getDb();
    return db.get('entries', id);
  },
  async persist(entry) {
    const db = await getDb();
    await db.put('entries', entry);
  },
};

type RawRead =
  | { ok: true; value: WorkspaceState | null }
  | { ok: false; code: WorkspacePersistenceErrorCode };

/**
 * Read the stored state. `value: null` means the key is absent — a distinction
 * the write path needs (nothing stored is never "newer" than the incoming
 * state) while the public reader maps it to the initial state.
 *
 * A schema-invalid or superseded stored value is migrated (throw-free, total)
 * and re-validated, so a corrupt blob resolves a safe schema-valid state rather
 * than throwing. Only an unreadable store or an unmigratable value is a typed
 * failure.
 */
async function readStoredState(storage: WorkspaceStorageArea): Promise<RawRead> {
  let raw: string | null;
  try {
    raw = await storage.getItem(WORKSPACE_STORAGE_KEY);
  } catch (error) {
    debugLog('WORKSPACE_READ_FAILED', 'The workspace key could not be read', {
      key: WORKSPACE_STORAGE_KEY,
      reason: errorName(error),
    });
    return { ok: false, code: 'WORKSPACE_READ_FAILED' };
  }

  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };

  const stored = parseStoredValue(raw);
  const migrated = migrateWorkspaceState(stored, persistedSchemaVersion(stored));
  const validated = parseWorkspaceState(migrated);
  if (!validated.ok) {
    debugLog('WORKSPACE_STATE_INVALID', 'The stored workspace value could not be migrated', {
      key: WORKSPACE_STORAGE_KEY,
      code: validated.code,
    });
    return { ok: false, code: 'WORKSPACE_STATE_INVALID' };
  }

  return { ok: true, value: validated.value };
}

/**
 * Read the workspace state.
 *
 * Total and throw-free: a missing key resolves the initial state, a
 * schema-invalid or superseded stored value is migrated to a schema-valid one,
 * and an unreadable store resolves `WORKSPACE_READ_FAILED`.
 */
export async function readWorkspaceState(
  deps: WorkspacePersistenceDeps = {},
): Promise<WorkspaceReadResult> {
  const storage = deps.storage ?? chromeStorageAdapter;
  const stored = await readStoredState(storage);
  if (!stored.ok) return stored;
  return { ok: true, value: stored.value ?? createInitialWorkspaceState() };
}

/**
 * Persist the workspace state in §20.3's order, or reject it.
 *
 * Rejected, with the stored value untouched: a state that fails the strict
 * schema, an unreadable store (never write blind), and any write whose
 * `version` is not strictly greater than the stored `version`.
 *
 * A failed step leaves the journal entry **non-terminal** (`applying`) with the
 * failing stage visible — `runJournaled`'s terminal `rolled-back` is
 * deliberately overridden, because the workspace write is forward-only: the
 * steps' rollbacks are no-ops (deleting a newer stored state would lose data)
 * and the next attempt with the same idempotency key resumes the entry.
 */
export async function writeWorkspaceState(
  next: WorkspaceState,
  deps: WorkspacePersistenceDeps = {},
): Promise<WorkspaceWriteResult> {
  const storage = deps.storage ?? chromeStorageAdapter;
  const journal = deps.journal ?? defaultJournalStore;
  const now = deps.now ?? Date.now;
  const publishUpdate = deps.publishUpdate ?? ((signal: WorkspaceUpdateSignal) => publish(WORKSPACE_CHANNEL, signal));

  // Boundary validation: only a schema-valid state is ever persisted.
  const validated = parseWorkspaceState(next);
  if (!validated.ok) {
    debugLog('WORKSPACE_STATE_INVALID', 'The workspace write was rejected by the strict schema', {
      code: validated.code,
    });
    return { ok: false, code: 'WORKSPACE_STATE_INVALID' };
  }
  const candidate = validated.value;

  const stored = await readStoredState(storage);
  if (!stored.ok) return stored;

  // Last-write-wins by the integer version: strictly greater, or rejected.
  if (stored.value !== null && candidate.version <= stored.value.version) {
    debugLog('WORKSPACE_VERSION_REJECTED', 'The workspace write was rejected as non-monotonic', {
      incomingVersion: candidate.version,
      storedVersion: stored.value.version,
    });
    return { ok: false, code: 'WORKSPACE_VERSION_REJECTED' };
  }

  const created = await createJournalEntry(
    {
      id: workspaceJournalId(candidate),
      operation: 'update-workspace',
      targetIds: { workspaceId: candidate.workspaceId },
      stageNames: WORKSPACE_WRITE_STAGE_NAMES,
      now: now(),
    },
    journal,
  );
  if (!created.ok) {
    debugLog('WORKSPACE_JOURNAL_FAILED', 'The update-workspace journal entry could not be created', {
      operation: 'update-workspace',
    });
    return { ok: false, code: 'WORKSPACE_JOURNAL_FAILED' };
  }

  const entry = created.entry;
  const signal: WorkspaceUpdateSignal = {
    workspaceId: candidate.workspaceId,
    conversationId: candidate.conversationId,
  };

  const steps: JournalStep[] = [
    {
      name: WORKSPACE_WRITE_STAGE_NAMES[0],
      // Idempotent by contract: re-writing the same state is the same state.
      apply: async () => {
        await storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(candidate));
      },
      // Forward-only: never delete a stored state on a later step's failure.
      rollback: async () => {},
    },
    {
      name: WORKSPACE_WRITE_STAGE_NAMES[1],
      apply: async () => {
        publishUpdate(signal);
      },
      rollback: async () => {},
    },
  ];

  try {
    await runJournaled(entry, steps, (candidateEntry: WriteJournalEntry) => journal.persist(candidateEntry), {
      now,
    });
  } catch (error) {
    // D2-12's resumability, applied to the workspace write: `runJournaled` has
    // already persisted its terminal `rolled-back`; this is the deliberate
    // override so the next attempt resumes the same entry.
    entry.status = 'applying';
    entry.updatedAt = now();
    try {
      await journal.persist(entry);
    } catch (persistError) {
      debugLog('WORKSPACE_JOURNAL_FAILED', 'The journal entry could not be persisted after a failure', {
        reason: errorName(persistError),
      });
    }

    debugLog('WORKSPACE_WRITE_FAILED', 'The workspace write failed; the entry stays non-terminal', {
      reason: errorName(error),
    });
    return { ok: false, code: 'WORKSPACE_WRITE_FAILED' };
  }

  return { ok: true, value: candidate };
}

/**
 * Subscribe to workspace updates from the other surface.
 *
 * The transport already suppresses this surface's own echo (BroadcastBus's
 * sender field), the payload is validated against the strict two-identifier
 * schema, and the listener is invoked with a **freshly re-read** schema-valid
 * state — only when that re-read version is newer than the last version this
 * subscriber delivered. A duplicate, stale or forged signal therefore never
 * moves the local copy, and no state object is ever taken from the channel.
 *
 * Returns the unsubscribe function.
 */
export function subscribeToWorkspaceChanges(
  listener: (state: WorkspaceState) => void,
  deps: WorkspacePersistenceDeps = {},
): () => void {
  const storage = deps.storage ?? chromeStorageAdapter;
  let lastDeliveredVersion = -1;

  return subscribe<unknown>(WORKSPACE_CHANNEL, (payload) => {
    const parsed = workspaceUpdateSignalSchema.safeParse(payload);
    if (!parsed.success) {
      debugLog('WORKSPACE_UPDATE_PAYLOAD_REJECTED', 'The workspace update signal failed the strict schema', {
        issueCount: parsed.error.issues.length,
      });
      return;
    }

    void readStoredState(storage).then((stored) => {
      if (!stored.ok) {
        debugLog('WORKSPACE_READ_FAILED', 'The workspace update could not be re-read', {
          code: stored.code,
        });
        return;
      }
      if (stored.value === null) return;
      if (stored.value.workspaceId !== parsed.data.workspaceId) return;
      if (stored.value.version <= lastDeliveredVersion) return;

      lastDeliveredVersion = stored.value.version;
      listener(stored.value);
    });
  });
}
