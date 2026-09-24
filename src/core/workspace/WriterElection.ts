import { z } from 'zod';
import { debugLog } from '../log/debugLog';
import type { ActiveSurface } from './WorkspaceState';

/**
 * WriterElection — the single-writer authority (§13, §15.1, §20.11).
 *
 * ## The pinned mechanism, and the constraint the spec does not state
 *
 * Two surfaces (Side Panel and Standalone) race on one record in
 * `chrome.storage.session` under `PRIMARY_RECORD_KEY`; the record shape is
 * §15.1's `{ tabId, surface, electedAt }` verbatim. `chrome.storage` exposes
 * **no atomic compare-and-set**, so the election is implemented as
 * **read → validate freshness → write → read-back-verify** (RESEARCH Pattern 6):
 * authority is claimed only when the read-back is this writer's own record with
 * the exact `electedAt` written. A lost race therefore becomes a typed
 * secondary outcome rather than two surfaces that both believe they won
 * (T-02-30, T-02-34).
 *
 * ## The write must not be debounced
 *
 * Every read and write here goes **directly** to the session area — never
 * through the debounced `chromeStorageAdapter` (RESEARCH Pitfall 1). A 300 ms
 * trailing debounce cannot be read back immediately, so the CAS would always
 * lose in the real extension and the record would appear absent in tests. This
 * module imports no adapter at all; the suite asserts that.
 *
 * ## `electedAt` doubles as the writer epoch
 *
 * Each election and each heartbeat re-mints `electedAt`, so the record's value
 * is simultaneously the election epoch and the liveness timestamp — no extra
 * field, so §15.1's pinned record shape is preserved. A record older than
 * `STALE_AFTER_MS` (two heartbeat intervals) is stale and any surface may
 * elect; that is how a closed surface's primacy is released with no explicit
 * teardown message (the background service worker is **not** a participant).
 *
 * ## Stale-writer rejection and deterministic conflict resolution
 *
 * `assertStillPrimary()` re-reads immediately before an authoritative write and
 * accepts only when the record's identity is this writer's **and** its
 * `electedAt` is not newer than this writer's last verified refresh; on any
 * rejection it demotes to the mirror state instead of retrying the write
 * (T-02-31). Two surfaces electing at the same `electedAt` resolve by the
 * deterministic key `(electedAt, surfacePriority, tabId)` — Standalone over
 * Side Panel, then the lower tab id — so the outcome is one primary and one
 * secondary, never two primaries.
 *
 * ## The canonical projection
 *
 * `coordinationState()` projects the last authoritative outcome into §20.11's
 * `WorkspaceCoordinationState` — exactly five states and no sixth: a lone
 * surface reports `solo`, a contested winner reports `primary` with the
 * surfaces it observed, a loser reports `secondary` with the mirroring flag,
 * a surface that has not yet resolved reports `election-in-progress`, and an
 * unverifiable CAS or an unavailable storage area reports the typed `error`
 * state with the canonical `ELECTION_TIMEOUT` / `STORAGE_UNAVAILABLE` codes
 * (the §C.2 `WORKSPACE_ELECTION_TIMEOUT` / `WORKSPACE_STORAGE_UNAVAILABLE`
 * identifiers are used only as log codes on the same path — never as a second
 * payload vocabulary). No optimistic promotion path exists: a surface reports
 * primary only after a verified read-back.
 */

/** The §15.1 election record key. Written directly, never debounced. */
export const PRIMARY_RECORD_KEY = 'np_workspace_primary';

/** §13/§20.11: the heartbeat interval. */
export const HEARTBEAT_MS = 3000;

/** Missed two heartbeats ⇒ the record is stale and any surface may elect. */
export const STALE_AFTER_MS = 2 * HEARTBEAT_MS;

/** The §15.1 record shape, verbatim — no extra field carries the epoch. */
export interface PrimaryRecord {
  tabId: number;
  surface: ActiveSurface;
  electedAt: number;
}

/** The strict record schema: an unvalidated record can never grant authority. */
export const primaryRecordSchema = z
  .object({
    tabId: z.number().int(),
    surface: z.enum(['sidepanel', 'standalone']),
    electedAt: z.number().int().min(0),
  })
  .strict();

/** The canonical §20.11 error codes — the payload vocabulary, verbatim. */
export type WorkspaceElectionErrorCode = 'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE';

/** The canonical §20.11 coordination projection. Five states, no sixth. */
export type WorkspaceCoordinationState =
  | { state: 'solo'; primarySurface: ActiveSurface }
  | { state: 'primary'; surface: ActiveSurface; secondaries: ActiveSurface[] }
  | { state: 'secondary'; primarySurface: ActiveSurface; isMirroring: boolean }
  | { state: 'election-in-progress'; startedAt: number }
  | { state: 'error'; code: WorkspaceElectionErrorCode; message: string };

/** The typed outcome of one election attempt. */
export type ElectionOutcome =
  | { kind: 'primary'; epoch: number }
  | { kind: 'secondary'; current: PrimaryRecord }
  | { kind: 'error'; code: WorkspaceElectionErrorCode; message: string };

/** Why a pre-write authority assertion was rejected. */
export type WriterRejectionCode = 'WORKSPACE_WRITER_REJECTED' | 'WORKSPACE_STORAGE_UNAVAILABLE';

export type StillPrimaryResult = { ok: true } | { ok: false; code: WriterRejectionCode };

/**
 * The minimal session-storage surface this module needs. `chrome.storage.session`
 * satisfies it structurally; a test injects a Map-backed fake or a failing one.
 */
export interface PrimaryRecordStorageArea {
  get(keys: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove?(keys: string | string[]): Promise<void>;
}

export interface WriterElectionDeps {
  surface: ActiveSurface;
  tabId: number;
  /** Production default: `chrome.storage.session`. */
  sessionStorage?: PrimaryRecordStorageArea | null;
  /** Deterministic clock seam. */
  now?(): number;
  /** Timer seams — production defaults are the platform's. */
  setInterval?(handler: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval?(handle: ReturnType<typeof setInterval>): void;
}

export interface WriterElection {
  readonly surface: ActiveSurface;
  readonly tabId: number;
  /** Read → validate freshness → write → read-back-verify. Never throws. */
  elect(): Promise<ElectionOutcome>;
  /** Refresh the record every `HEARTBEAT_MS`; also the promotion path. */
  startHeartbeat(): void;
  /** Stop heartbeating and release the record when this identity still owns it. */
  stop(): void;
  /** The pre-write authority gate (T-02-31). Never throws. */
  assertStillPrimary(): Promise<StillPrimaryResult>;
  /** The canonical §20.11 projection of the last authoritative outcome. */
  coordinationState(): WorkspaceCoordinationState;
}

/** A record older than two heartbeat intervals is stale (strictly older). */
export function isStale(record: PrimaryRecord, now: number): boolean {
  return now - record.electedAt > STALE_AFTER_MS;
}

function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** Standalone outranks Side Panel; then the lower tab id wins. */
function surfacePriority(surface: ActiveSurface): number {
  return surface === 'standalone' ? 1 : 0;
}

/** Positive when `a` wins the deterministic ordering key. */
function comparePriority(
  a: { surface: ActiveSurface; tabId: number },
  b: { surface: ActiveSurface; tabId: number },
): number {
  const priority = surfacePriority(a.surface) - surfacePriority(b.surface);
  if (priority !== 0) return priority;
  return b.tabId - a.tabId;
}

/** Resolved per call — never at module scope, so the module imports anywhere. */
function resolveSessionArea(
  injected: PrimaryRecordStorageArea | null | undefined,
): PrimaryRecordStorageArea | null {
  if (injected !== undefined) return injected;
  const area = typeof chrome !== 'undefined' ? chrome?.storage?.session : undefined;
  return area ? (area as unknown as PrimaryRecordStorageArea) : null;
}

type RecordRead = { ok: true; value: PrimaryRecord | null } | { ok: false; code: 'STORAGE_UNAVAILABLE' };
type RecordWrite = { ok: true } | { ok: false; code: 'STORAGE_UNAVAILABLE' };

async function readRecord(area: PrimaryRecordStorageArea | null): Promise<RecordRead> {
  if (area === null) {
    debugLog('WORKSPACE_STORAGE_UNAVAILABLE', 'The election storage area is unavailable', {
      key: PRIMARY_RECORD_KEY,
    });
    return { ok: false, code: 'STORAGE_UNAVAILABLE' };
  }

  let stored: Record<string, unknown>;
  try {
    stored = await area.get(PRIMARY_RECORD_KEY);
  } catch (error) {
    debugLog('WORKSPACE_STORAGE_UNAVAILABLE', 'The election record could not be read', {
      key: PRIMARY_RECORD_KEY,
      reason: errorName(error),
    });
    return { ok: false, code: 'STORAGE_UNAVAILABLE' };
  }

  const raw = stored?.[PRIMARY_RECORD_KEY];
  if (raw === undefined || raw === null) return { ok: true, value: null };

  const candidate = typeof raw === 'string' ? safeJson(raw) : raw;
  const parsed = primaryRecordSchema.safeParse(candidate);
  if (!parsed.success) {
    // No surface may claim authority from a record this build cannot validate;
    // an unreadable record is treated as absent so any surface may elect.
    debugLog('WORKSPACE_ELECTION_RECORD_INVALID', 'The election record failed the strict schema', {
      key: PRIMARY_RECORD_KEY,
    });
    return { ok: true, value: null };
  }

  return { ok: true, value: parsed.data };
}

async function writeRecord(
  area: PrimaryRecordStorageArea | null,
  record: PrimaryRecord,
): Promise<RecordWrite> {
  if (area === null) {
    debugLog('WORKSPACE_STORAGE_UNAVAILABLE', 'The election storage area is unavailable', {
      key: PRIMARY_RECORD_KEY,
    });
    return { ok: false, code: 'STORAGE_UNAVAILABLE' };
  }

  try {
    await area.set({ [PRIMARY_RECORD_KEY]: record });
    return { ok: true };
  } catch (error) {
    debugLog('WORKSPACE_STORAGE_UNAVAILABLE', 'The election record could not be written', {
      key: PRIMARY_RECORD_KEY,
      reason: errorName(error),
    });
    return { ok: false, code: 'STORAGE_UNAVAILABLE' };
  }
}

export function createWriterElection(deps: WriterElectionDeps): WriterElection {
  const { surface, tabId } = deps;
  const area = resolveSessionArea(deps.sessionStorage);
  const now = deps.now ?? Date.now;
  const setIntervalFn = deps.setInterval ?? ((handler, ms) => setInterval(handler, ms));
  const clearIntervalFn =
    deps.clearInterval ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));

  const startedAt = now();
  let outcome: ElectionOutcome | { kind: 'election-in-progress' } = {
    kind: 'election-in-progress',
  };
  /** The `electedAt` of this writer's last **verified** write. */
  let lastRefresh = -1;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  /** Other surfaces observed live in the record — the projection's secondaries. */
  const observed = new Map<number, ActiveSurface>();

  function isSelf(record: PrimaryRecord): boolean {
    return record.tabId === tabId && record.surface === surface;
  }

  function fail(code: WorkspaceElectionErrorCode, message: string): ElectionOutcome {
    debugLog(
      code === 'ELECTION_TIMEOUT' ? 'WORKSPACE_ELECTION_TIMEOUT' : 'WORKSPACE_STORAGE_UNAVAILABLE',
      message,
      { surface, tabId },
    );
    outcome = { kind: 'error', code, message };
    return outcome;
  }

  async function elect(): Promise<ElectionOutcome> {
    const at = now();
    const current = await readRecord(area);
    if (!current.ok) {
      return fail('STORAGE_UNAVAILABLE', 'The election record could not be read');
    }

    const record = current.value;
    if (record === null) {
      // Nothing holds authority: any surface observed earlier released or
      // vanished, so it is not a live secondary.
      observed.clear();
    }

    if (record !== null && !isSelf(record)) {
      if (!isStale(record, at)) {
        const tie = record.electedAt === at;
        const winsTie = tie && comparePriority({ surface, tabId }, record) > 0;
        if (!winsTie) {
          observed.set(record.tabId, record.surface);
          outcome = { kind: 'secondary', current: record };
          return outcome;
        }
        // Equal-epoch tie resolved in this surface's favour: contest it.
        observed.set(record.tabId, record.surface);
      } else {
        // Stale: the previous owner is no longer live, so it is not a secondary.
        observed.delete(record.tabId);
      }
    }

    const mine: PrimaryRecord = { tabId, surface, electedAt: at };
    const written = await writeRecord(area, mine);
    if (!written.ok) {
      return fail('STORAGE_UNAVAILABLE', 'The election record could not be written');
    }

    // The read-back is the compare-and-set: authority is claimed only when the
    // record that actually landed is this write.
    const readBack = await readRecord(area);
    if (!readBack.ok) {
      return fail('STORAGE_UNAVAILABLE', 'The election record could not be verified');
    }

    if (
      readBack.value !== null &&
      isSelf(readBack.value) &&
      readBack.value.electedAt === mine.electedAt
    ) {
      lastRefresh = mine.electedAt;
      outcome = { kind: 'primary', epoch: mine.electedAt };
      return outcome;
    }

    if (readBack.value !== null && !isSelf(readBack.value)) {
      // The CAS was lost to a surface we can name: report it rather than claim.
      observed.set(readBack.value.tabId, readBack.value.surface);
      outcome = { kind: 'secondary', current: readBack.value };
      return outcome;
    }

    // The read-back confirms neither this write nor a visible owner: the CAS
    // cannot be verified, so no authority is claimed and no outcome fabricated.
    return fail('ELECTION_TIMEOUT', 'The election record could not be verified after the write');
  }

  async function removeIfOwned(): Promise<void> {
    const current = await readRecord(area);
    if (!current.ok || current.value === null || !isSelf(current.value)) return;
    if (!area?.remove) return;

    try {
      await area.remove(PRIMARY_RECORD_KEY);
      lastRefresh = -1;
    } catch (error) {
      debugLog('WORKSPACE_STORAGE_UNAVAILABLE', 'The election record could not be released on stop', {
        key: PRIMARY_RECORD_KEY,
        reason: errorName(error),
      });
    }
  }

  return {
    surface,
    tabId,

    elect,

    startHeartbeat(): void {
      if (heartbeat !== null) return;
      // The same write-then-read-back path re-mints the epoch. A surface that
      // is secondary keeps probing here, which is how it promotes itself once
      // the primary's record goes stale (§13's "next surface auto-promotes").
      heartbeat = setIntervalFn(() => {
        void elect();
      }, HEARTBEAT_MS);
    },

    stop(): void {
      if (heartbeat !== null) {
        clearIntervalFn(heartbeat);
        heartbeat = null;
      }
      // A closing surface simply stops heartbeating and releases the record
      // when it still owns it; the other surface promotes itself.
      void removeIfOwned();
    },

    async assertStillPrimary(): Promise<StillPrimaryResult> {
      const current = await readRecord(area);
      if (!current.ok) return { ok: false, code: 'WORKSPACE_STORAGE_UNAVAILABLE' };

      const record = current.value;
      if (record === null) {
        debugLog('WORKSPACE_WRITER_REJECTED', 'The election record is absent before a write', {
          surface,
          tabId,
          reason: 'absent',
        });
        fail('ELECTION_TIMEOUT', 'The election record is absent');
        return { ok: false, code: 'WORKSPACE_WRITER_REJECTED' };
      }

      if (!isSelf(record) || record.electedAt > lastRefresh) {
        debugLog('WORKSPACE_WRITER_REJECTED', 'The workspace writer is no longer authoritative', {
          surface,
          tabId,
          reason: isSelf(record) ? 'newer-epoch' : 'other-identity',
        });
        if (!isSelf(record)) observed.set(record.tabId, record.surface);
        outcome = { kind: 'secondary', current: record };
        return { ok: false, code: 'WORKSPACE_WRITER_REJECTED' };
      }

      return { ok: true };
    },

    coordinationState(): WorkspaceCoordinationState {
      if (outcome.kind === 'primary') {
        const secondaries = [...observed.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, observedSurface]) => observedSurface);
        const distinct = [...new Set(secondaries)];
        return distinct.length === 0
          ? { state: 'solo', primarySurface: surface }
          : { state: 'primary', surface, secondaries: distinct };
      }

      if (outcome.kind === 'secondary') {
        return {
          state: 'secondary',
          primarySurface: outcome.current.surface,
          isMirroring: true,
        };
      }

      if (outcome.kind === 'error') {
        return { state: 'error', code: outcome.code, message: outcome.message };
      }

      return { state: 'election-in-progress', startedAt };
    },
  };
}

// ---------------------------------------------------------------------------
// The active-instance registry (plan `02-09`)
// ---------------------------------------------------------------------------
//
// A surface owns exactly one election instance, and the surface root registers
// it here (02-10) so that any component that needs to ask "let this surface
// take over" — the `MirrorBanner` action — can reach it without a prop chain
// through the shell. The registry follows `MessageBus`'s module-registry shape:
// a module-level set of subscribers, an unregister function as the return
// value, and nothing that pretends to be durable state.
//
// It holds a **reference** to the current instance and nothing else: no
// election state, no outcome, no epoch and no writer projection is mirrored
// here. Authority is still established only by `elect()`'s verified read-back;
// a refocus request is a request, and the outcome it returns is the election's
// own report. The banner's visibility never comes from this module — it comes
// from the store's `writerState`, which the surface applies from an
// authoritative coordination projection.

/**
 * A refocus failure, in the canonical §20.11 payload vocabulary — the same two
 * literals `WorkspaceCoordinationState`'s error variant carries. The §C.2
 * `WORKSPACE_ELECTION_TIMEOUT` / `WORKSPACE_STORAGE_UNAVAILABLE` identifiers
 * are the one-way mapping to log codes on this path, never a second payload
 * vocabulary: the code reported here is the code the caller receives.
 */
export type ElectionFailureCode = WorkspaceElectionErrorCode;

type ElectionFailureListener = (code: ElectionFailureCode) => void;

let activeWriterElection: WriterElection | null = null;
const electionFailureListeners = new Set<ElectionFailureListener>();

/**
 * Register (or clear, with `null`) this surface's election instance. The
 * surface root calls it after `createWriterElection` and clears it on
 * teardown, so a closed surface can never be the target of a refocus request.
 */
export function setActiveWriterElection(instance: WriterElection | null): void {
  activeWriterElection = instance;
}

/** True while a surface election is registered and reachable. */
export function isWriterElectionRegistered(): boolean {
  return activeWriterElection !== null;
}

/**
 * Subscribe to refocus failures. The listener receives one canonical code per
 * failure; the returned function unsubscribes. Repeated failures each report —
 * the caller decides whether that is one notice or several.
 */
export function subscribeToElectionFailure(listener: ElectionFailureListener): () => void {
  electionFailureListeners.add(listener);
  return () => {
    electionFailureListeners.delete(listener);
  };
}

function reportElectionFailure(code: ElectionFailureCode): void {
  for (const listener of [...electionFailureListeners]) {
    try {
      listener(code);
    } catch (error) {
      // A subscriber must never break the refocus path it observes.
      debugLog('WORKSPACE_ELECTION_TIMEOUT', 'An election failure listener threw', {
        reason: errorName(error),
      });
    }
  }
}

/**
 * The pre-write authority gate against this surface's registered election
 * (02-06's `assertStillPrimary`, reachable without a prop chain the way
 * `requestRefocus` is — the runtime calls it from the workspace write path).
 *
 * A write is never authorised without an authoritative election: no registered
 * instance resolves the typed `STORAGE_UNAVAILABLE` rejection rather than
 * granting a write.
 */
export async function assertActiveWriterStillPrimary(): Promise<StillPrimaryResult> {
  const election = activeWriterElection;
  if (election === null) {
    return { ok: false, code: 'WORKSPACE_STORAGE_UNAVAILABLE' };
  }
  return election.assertStillPrimary();
}

/**
 * Ask the active election to promote this surface, and report the outcome
 * through the failure channel when it does not reach primary.
 *
 * Non-optimistic by construction: this function changes no local state and
 * returns the election's own outcome. A promotion becomes visible only when
 * authoritative state says `primary` — the caller re-renders from the store,
 * never from this call's resolution.
 *
 *   - no instance registered → `{ kind: 'error', code: 'STORAGE_UNAVAILABLE' }`,
 *     never a fabricated success
 *   - election error        → reported with the election's own canonical code
 *   - secondary outcome     → reported as `ELECTION_TIMEOUT`: the record is
 *     still held by a live surface, so this refocus did not reach primary and
 *     must not pass unnoticed. `ELECTION_TIMEOUT` is the only non-storage
 *     member of the canonical code set, and the §C.2 log code carries the
 *     same meaning the election's own unverified-CAS path records
 *   - primary outcome       → reported as nothing at all: success needs no
 *     notice, and the banner unmounts through state
 */
export async function requestRefocus(): Promise<ElectionOutcome> {
  const election = activeWriterElection;
  if (election === null) {
    debugLog('WORKSPACE_STORAGE_UNAVAILABLE', 'A refocus request found no registered election');
    const unavailable: ElectionOutcome = {
      kind: 'error',
      code: 'STORAGE_UNAVAILABLE',
      message: 'No writer election is registered for this surface',
    };
    reportElectionFailure(unavailable.code);
    return unavailable;
  }

  const outcome = await election.elect();
  if (outcome.kind === 'error') {
    reportElectionFailure(outcome.code);
  } else if (outcome.kind === 'secondary') {
    debugLog('WORKSPACE_ELECTION_TIMEOUT', 'A refocus request did not reach primary', {
      surface: election.surface,
      tabId: election.tabId,
    });
    reportElectionFailure('ELECTION_TIMEOUT');
  }
  return outcome;
}
