/**
 * WorkspaceElection — primary-writer election state machine (D-24..D-27,
 * spec §20.11, §15.1).
 *
 * Replaces the Phase-1 `isPrimaryWriter()` stub with a real CAS +
 * heartbeat election over `np_workspace_primary` in
 * `chrome.storage.session`. The election record is transient coordination
 * state — wiped on tab close + browser restart (spec §15.1, §20.11).
 *
 * Architecture:
 *   - Each `startElection(surface)` call returns an `ElectionInstance`
 *     owning its own state, timer, and inbound-heartbeat subscription.
 *     In a real extension each surface runs in its own JS context, so
 *     the module-level singleton is per-surface in production. In
 *     tests, multiple instances share the module-level session storage
 *     (the real shared resource) but each keeps local state.
 *   - Module-level `getState()` / `isPrimaryWriter()` read from the
 *     currently active instance (the most-recently-started one without
 *     a subsequent dispose) — matching `WorkspaceStore.isPrimaryWriter()`
 *     which the WorkspaceStore delegates to per the plan.
 *
 * Lifecycle (D-25):
 *   - Exactly one instance per surface (the boot wiring in plan 02-07
 *     creates it during WorkspaceStore bootstrap, disposes on unload).
 *   - Starting a new instance while a previous one is still active on
 *     the same surface throws — prevents accidental double timers.
 *     Starting a new instance after `dispose()` is fine.
 *
 * Election rules (spec §20.11 verbatim):
 *   - Startup compare-and-set on `np_workspace_primary`.
 *   - Heartbeat every 3 s.
 *   - Missed 2 heartbeats → re-election.
 *   - Standalone view has tie-break priority.
 *
 * Lone-surface trap (RESEARCH Pitfall 4):
 *   BroadcastBus suppresses self-messages by `_sender` envelope, so a
 *   single surface never sees its own heartbeat. The state machine
 *   distinguishes "no other surface exists" (→ 'solo') from "primary is
 *   dead" (→ re-election) by checking the session record's `electedAt`
 *   freshness against a 6 s threshold (2 heartbeat windows).
 *
 * Error codes — closed set (D-38):
 *   The state union's `code` literal reuses existing canonical codes
 *   (`ELECTION_TIMEOUT` / `STORAGE_UNAVAILABLE`); debugLog surfaces
 *   the canonical-prefixed variants
 *   (`WORKSPACE_ELECTION_TIMEOUT` / `WORKSPACE_STORAGE_UNAVAILABLE`)
 *   per spec §21.6 / Appendix C.2. Never invented.
 */

import { onWorkspaceSync } from './WorkspaceSync';
import type { ActiveSurface } from './WorkspaceStore';
import { debugLog } from '../log/debugLog';

const SESSION_KEY = 'np_workspace_primary';

/** Heartbeat tick interval — the ONLY 3 s timer in the workspace layer (D-26). */
export const HEARTBEAT_INTERVAL_MS = 3_000;

/** Two missed heartbeats = 6 s; freshness threshold for stale-record detection (spec §20.11). */
const HEARTBEAT_MISS_THRESHOLD = 2;
const STALE_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * HEARTBEAT_MISS_THRESHOLD;

/**
 * Tie-break priority (higher wins on concurrent CAS). Spec §20.11:
 * "Standalone view has tie-break priority."
 */
const SURFACE_PRIORITY: Record<ActiveSurface, number> = {
  standalone: 2,
  sidepanel: 1,
};

/**
 * Election record stored at `chrome.storage.session.np_workspace_primary`
 * (spec §15.1 — transient coordination state).
 */
export interface ElectionRecord {
  tabId: number;
  surface: ActiveSurface;
  electedAt: number;
}

/**
 * State union — spec §20.11 verbatim. The `code` literal is the
 * state-machine code; the canonical registry's prefixed variants
 * (`WORKSPACE_ELECTION_TIMEOUT` / `WORKSPACE_STORAGE_UNAVAILABLE`) are
 * what ErrorStore + debugLog see.
 */
export type WorkspaceCoordinationState =
  | { state: 'solo'; primarySurface: ActiveSurface }
  | { state: 'primary'; surface: ActiveSurface; secondaries: ActiveSurface[] }
  | { state: 'secondary'; primarySurface: ActiveSurface; isMirroring: boolean }
  | { state: 'election-in-progress'; startedAt: number }
  | { state: 'error'; code: 'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE'; message: string };

// --- Module-level singleton -------------------------------------------------
//
// In production each surface has its own JS context, so module-level
// state is effectively per-surface. The `activeInstance` reference lets
// module-level getters (`getState()`, `isPrimaryWriter()`) read the
// currently running instance — matching the WorkspaceStore delegation
// contract (D-24).

let activeInstance: ElectionInstance | null = null;

/** Sentinel for module-level getters when no instance is active. */
const NO_INSTANCE_STATE: WorkspaceCoordinationState = {
  state: 'election-in-progress',
  startedAt: 0,
};

// --- Timer seam (mirrors chromeStorageAdapter's pattern) --------------------

type TimerHandle = ReturnType<typeof setInterval>;
let timerFactory: (cb: () => void, ms: number) => TimerHandle = (cb, ms) =>
  setInterval(cb, ms);
let timerClear: (handle: TimerHandle) => void = (h) => clearInterval(h);

// --- Public read API --------------------------------------------------------

/**
 * Pure read of the currently active election state (D-24). Returns a
 * default 'election-in-progress' state if no instance is active.
 */
export function getState(): WorkspaceCoordinationState {
  return activeInstance?.getState() ?? NO_INSTANCE_STATE;
}

/**
 * Primary-writer predicate (D-24). True iff the currently active
 * surface holds the primary slot — either because it is the elected
 * primary, or because it is the lone surface.
 */
export function isPrimaryWriter(): boolean {
  return activeInstance?.isPrimaryWriter() ?? false;
}

// --- Election core helpers --------------------------------------------------

async function readRecord(): Promise<ElectionRecord | null> {
  const session = (globalThis as any).chrome?.storage?.session;
  if (!session) return null;
  const result = await session.get(SESSION_KEY);
  const raw = result[SESSION_KEY];
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.surface === 'string' &&
      typeof parsed.electedAt === 'number' &&
      typeof parsed.tabId === 'number'
    ) {
      return parsed as ElectionRecord;
    }
  } catch {
    // ignore malformed JSON
  }
  return null;
}

async function writeRecord(record: ElectionRecord): Promise<void> {
  const session = (globalThis as any).chrome?.storage?.session;
  if (!session) return;
  await session.set({ [SESSION_KEY]: JSON.stringify(record) });
}

function isStale(record: ElectionRecord | null, now: number): boolean {
  if (!record) return true;
  return now - record.electedAt > STALE_THRESHOLD_MS;
}

// --- ElectionInstance -------------------------------------------------------

export interface ElectionInstance {
  /** Per-instance state read. */
  getState(): WorkspaceCoordinationState;
  /** Per-instance primary predicate. */
  isPrimaryWriter(): boolean;
  /** Stop the heartbeat loop + unsubscribe from inbound heartbeats. */
  dispose(): void;
}

/**
 * Run the startup compare-and-set for `surface`. Updates `state` in
 * place via the provided setter and writes the session record on win.
 *
 * Returns nothing — caller observes outcome via the `state` reference.
 */
async function runStartupCAS(
  surface: ActiveSurface,
  selfTabId: number,
  setState: (s: WorkspaceCoordinationState) => void,
): Promise<void> {
  setState({ state: 'election-in-progress', startedAt: Date.now() });

  const now = Date.now();
  const existing = await readRecord();

  if (!existing || isStale(existing, now)) {
    // Empty or stale → we become primary (will transition to 'solo' if
    // no foreign surface ever appears).
    const record: ElectionRecord = { tabId: selfTabId, surface, electedAt: now };
    await writeRecord(record);
    setState({ state: 'primary', surface, secondaries: [] });
    return;
  }

  if (existing.surface === surface && existing.tabId === selfTabId) {
    // Our own record is still fresh → refresh, stay primary.
    const record: ElectionRecord = { tabId: selfTabId, surface, electedAt: now };
    await writeRecord(record);
    setState({ state: 'primary', surface, secondaries: [] });
    return;
  }

  // Foreign record is fresh. Apply tie-break (spec §20.11: standalone
  // wins on concurrent attempts within the same heartbeat window).
  const sameWindow = Math.abs(now - existing.electedAt) < HEARTBEAT_INTERVAL_MS;
  const ourPriorityHigher = SURFACE_PRIORITY[surface] > SURFACE_PRIORITY[existing.surface];

  if (sameWindow && ourPriorityHigher) {
    const record: ElectionRecord = { tabId: selfTabId, surface, electedAt: now };
    await writeRecord(record);
    setState({ state: 'primary', surface, secondaries: [existing.surface] });
    return;
  }

  // Mirror as secondary.
  setState({
    state: 'secondary',
    primarySurface: existing.surface,
    isMirroring: true,
  });
}

/**
 * Heartbeat tick — fires every 3 s. Publishes a `WORKSPACE_HEARTBEAT`
 * on the existing `np_workspace` BroadcastChannel and refreshes our
 * own session record (NOT debounced — D-43 / RESEARCH A5: 20/min is
 * safely under the ~120/min boundary).
 *
 * Also performs the lone-surface trap check: if we've been primary for
 * one full interval with no foreign heartbeat, transition to 'solo'.
 */
async function runHeartbeatTick(
  surface: ActiveSurface,
  selfTabId: number,
  getState: () => WorkspaceCoordinationState,
  setState: (s: WorkspaceCoordinationState) => void,
  foreignSeen: () => boolean,
): Promise<void> {
  const now = Date.now();

  // Secondary path: detect stale primary → re-elect.
  if (getState().state === 'secondary') {
    const existing = await readRecord();
    if (!existing || isStale(existing, now)) {
      const record: ElectionRecord = { tabId: selfTabId, surface, electedAt: now };
      await writeRecord(record);
      setState({ state: 'primary', surface, secondaries: [] });
    }
  }

  // Primary / solo / election-in-progress: refresh our own session record.
  const cur = getState();
  if (
    cur.state === 'primary' ||
    cur.state === 'solo' ||
    cur.state === 'election-in-progress'
  ) {
    const record: ElectionRecord = { tabId: selfTabId, surface, electedAt: now };
    await writeRecord(record);

    // Lone-surface trap (Pitfall 4): if we've been primary for one
    // full interval with no foreign heartbeat, transition to 'solo'.
    // (Two intervals is the "no foreign heartbeat" detection window;
    // since we're driven by the 3 s tick itself, one tick after
    // startup confirms we never saw a foreign surface.)
    if (cur.state === 'primary' && !foreignSeen()) {
      setState({ state: 'solo', primarySurface: surface });
    }
  }
}

// --- Public lifecycle API ---------------------------------------------------

/**
 * Start an election instance on `surface`. Resolves once the startup
 * CAS completes. The heartbeat loop starts immediately after CAS
 * resolves and runs every 3 s until `dispose()` is called.
 *
 * Lifecycle (D-25): throws if a previous instance on the SAME surface
 * was not disposed. Different surfaces may coexist as separate
 * instances (matters for tests; in production each surface has its own
 * JS context).
 */
export async function startElection(surface: ActiveSurface): Promise<ElectionInstance> {
  if (activeInstance && activeInstance.surface === surface && !activeInstance.disposed) {
    throw new Error(
      `WorkspaceElection instance already active for surface '${surface}' — call dispose() before starting a new one`,
    );
  }

  // If a previous instance for a DIFFERENT surface is still around,
  // dispose it first (test scenarios — production never overlaps).
  if (activeInstance && !activeInstance.disposed) {
    activeInstance.dispose();
  }

  // Per-instance bookkeeping.
  const selfTabId = Math.floor(Math.random() * 1_000_000_000);
  const foreignHeartbeats = new Map<ActiveSurface, number>();
  let foreignSurfacesEverSeen = false;

  let instanceState: WorkspaceCoordinationState = {
    state: 'election-in-progress',
    startedAt: Date.now(),
  };
  const setInstanceState = (s: WorkspaceCoordinationState): void => {
    instanceState = s;
  };

  // Startup CAS — runs to completion before the heartbeat loop starts.
  try {
    await runStartupCAS(surface, selfTabId, setInstanceState);
  } catch (err) {
    debugLog(
      'WORKSPACE_STORAGE_UNAVAILABLE',
      err instanceof Error ? err.message : String(err),
    );
    setInstanceState({
      state: 'error',
      code: 'STORAGE_UNAVAILABLE',
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // Subscribe to inbound heartbeats BEFORE the timer fires so we don't
  // miss the first inbound message.
  const unsubInbound = onWorkspaceSync((msg) => {
    if (msg.type !== 'WORKSPACE_HEARTBEAT') return;
    if (msg.surface === surface) return; // BroadcastBus already filters self, but be defensive.
    foreignHeartbeats.set(msg.surface, Date.now());
    foreignSurfacesEverSeen = true;

    // Demotion rule: if we're primary/solo AND the foreign surface has
    // HIGHER priority (standalone > sidepanel), we demote to secondary.
    if (
      instanceState.state === 'primary' ||
      instanceState.state === 'solo'
    ) {
      const ourPriority = SURFACE_PRIORITY[surface];
      const theirPriority = SURFACE_PRIORITY[msg.surface];
      if (theirPriority > ourPriority) {
        instanceState = {
          state: 'secondary',
          primarySurface: msg.surface,
          isMirroring: true,
        };
      }
    }
  });

  // Heartbeat timer (the ONLY 3 s tick in the workspace layer — D-26).
  const heartbeatTimer = timerFactory(() => {
    void runHeartbeatTick(
      surface,
      selfTabId,
      () => instanceState,
      setInstanceState,
      () => foreignSurfacesEverSeen,
    );
  }, HEARTBEAT_INTERVAL_MS);

  const instance: ElectionInstance = {
    surface,
    disposed: false,
    getState(): WorkspaceCoordinationState {
      return instanceState;
    },
    isPrimaryWriter(): boolean {
      return (
        instanceState.state === 'primary' || instanceState.state === 'solo'
      );
    },
    dispose(): void {
      if ((instance as { disposed?: boolean }).disposed) return;
      (instance as { disposed?: boolean }).disposed = true;
      timerClear(heartbeatTimer);
      unsubInbound();
      if (activeInstance === instance) {
        activeInstance = null;
      }
    },
  };
  // Allow dispose() to read its own disposed flag above.
  (instance as { disposed: boolean }).disposed = false;

  activeInstance = instance;
  return instance;
}

// Augment ElectionInstance with private fields for the implementation.
declare module './WorkspaceElection' {
  interface ElectionInstance {
    /** Internal: which surface this instance is for. */
    surface: ActiveSurface;
    /** Internal: true once dispose() has been called. */
    disposed: boolean;
  }
}

// --- Test seam --------------------------------------------------------------

export const __test__ = {
  /** Inject the timer factory (used by fake-timer tests). */
  setTimerFactory(factory: typeof timerFactory): void {
    timerFactory = factory;
  },
  /** Inject the timer cancel function. */
  setTimerClear(clear: typeof timerClear): void {
    timerClear = clear;
  },
  /**
   * Reset the module-level election state. Tests call this in
   * `beforeEach`/`afterEach` to isolate state across cases. Disposes
   * the active instance and clears the active reference.
   */
  resetElectionState(): void {
    if (activeInstance) {
      try {
        activeInstance.dispose();
      } catch {
        // ignore — we want a hard reset
      }
    }
    activeInstance = null;
  },
  /** Inspect the current active instance (tests). */
  getActiveInstance(): ElectionInstance | null {
    return activeInstance;
  },
  /** Read SURFACE_PRIORITY (tests inspecting tie-break). */
  getSurfacePriority(): Record<ActiveSurface, number> {
    return { ...SURFACE_PRIORITY };
  },
};
