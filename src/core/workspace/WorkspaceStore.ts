// src/core/workspace/WorkspaceStore.ts — Source: §21.5 WorkspaceState (lines 3436-3464)
// + Appendix M.1 (lines 5868-5924, adapted to the 01-06 plan contract) + D-18.
// The single source of truth for cross-surface workspace state. Canonical
// durability is a storage ADAPTER that serializes ONLY the D-18 active fields
// (workspaceId / conversationId / activeSurface / openedStandaloneTabId) plus
// version / updatedAt to chrome.storage.local key np_workspace — deliberately NOT
// zustand's storage middleware (Pitfall 7: storage middleware writes localStorage,
// which does not cross surfaces). chrome.storage.onChanged propagates foreign-surface
// writes with version-LWW adoption (T-1-13: stored values are schema-validated
// before merge; unknown keys are never spread raw). M.3 workspace scope gate
// (WR-10): only snapshots carrying the LOCAL workspaceId propagate — a different
// window's workspace snapshot is ignored with a STORE_SYNC log, matching
// WorkspaceSync.handleRemoteUpdate so the two inbound paths agree. Inert
// WorkspaceState fields stay untouched by every mutation (D-18 / T-1-05). Every
// error path calls debugLog with a canonical WORKSPACE_*/STORE_* code and never
// throws (Golden Rule 9).
//
// D-06 rewire (Phase 2): every np_workspace write now flows EXCLUSIVELY through
// the WriteJournal — journaledUpdateWorkspace builds an 'update-workspace' entry
// and runs it through runJournaled (persistJournalEntry → WriteJournalDB), so a
// mid-write crash leaves an 'applying' entry that recoverWorkspaceJournal replays
// on the next init (atomic-on-recovery). Replay is workspace-scoped (D-07/WR-10)
// and unknown operation values are skipped-and-logged, never thrown (forward
// compat). The §20.3 step order is preserved: pending → write np_workspace →
// BroadcastBus WORKSPACE_UPDATED → completed.
import { create } from 'zustand';
import { produce } from 'immer';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { broadcastBus } from '@/core/runtime/BroadcastBus';
import { MessageType } from '@/core/runtime/MessageType';
import {
  loadPendingEntries,
  persistJournalEntry,
  recoverJournal,
  runJournaled,
  type JournalStep,
} from '@/core/storage/WriteJournal';
// WR-02: the restore-notes-batch replay handler lives in ImportExport (the
// merge owner); the workspace recovery path dispatches to it. Circular-module
// note: ImportExport imports NP_WORKSPACE_KEY from this module, but both sides
// only READ the other's exports inside functions (runtime), never at module
// top level, so the ESM cycle is safe.
import { replayRestoreEntry } from '@/core/storage/ImportExport';
import type { WriteJournalEntry } from '@/types/storage';
import type { ActiveSurface, WorkspaceState } from '@/types/workspace';

export const NP_WORKSPACE_KEY = 'np_workspace';

// D-18 active set — the ONLY fields serialized to storage (T-1-05).
const ACTIVE_FIELDS = [
  'workspaceId',
  'conversationId',
  'activeSurface',
  'openedStandaloneTabId',
  'version',
  'updatedAt',
] as const;

/** §21.5 defaults — workspaceId/conversationId are fresh UUIDs per store instance. */
function defaultState(): WorkspaceState {
  return {
    workspaceId: crypto.randomUUID(),
    conversationId: crypto.randomUUID(),
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'sidepanel',
    version: 0,
    updatedAt: Date.now(),
  };
}

/** Storage adapter — pick the D-18 active fields for serialization (inert fields excluded). */
function pickActive(ws: WorkspaceState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ACTIVE_FIELDS) {
    const value = ws[key];
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/**
 * T-1-13: validate a stored np_workspace value before it is ever merged. Returns a
 * Partial<WorkspaceState> carrying only the D-18 active fields, or null when the
 * payload is malformed (unknown keys are dropped — raw storage is never spread).
 *
 * SHARED inbound gate (01-11 WR-04): consumed by both the store's own onChanged
 * handler and WorkspaceSync's remote-update path (the cross-surface adoption
 * guard) — one sanitizer for every np_workspace value that reaches the store.
 */
export function sanitizeStored(value: unknown): Partial<WorkspaceState> | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.workspaceId !== 'string' || v.workspaceId.length === 0) return null;
  if (typeof v.conversationId !== 'string' || v.conversationId.length === 0) return null;
  if (v.activeSurface !== 'sidepanel' && v.activeSurface !== 'standalone') return null;
  if (typeof v.version !== 'number' || !Number.isFinite(v.version) || v.version < 0) return null;
  if (typeof v.updatedAt !== 'number' || !Number.isFinite(v.updatedAt)) return null;
  const out: Partial<WorkspaceState> = {
    workspaceId: v.workspaceId,
    conversationId: v.conversationId,
    activeSurface: v.activeSurface,
    version: v.version,
    updatedAt: v.updatedAt,
  };
  if (typeof v.openedStandaloneTabId === 'number' && Number.isInteger(v.openedStandaloneTabId)) {
    out.openedStandaloneTabId = v.openedStandaloneTabId;
  }
  return out;
}

/**
 * D-06 rewire — the ONLY np_workspace write path. Builds an 'update-workspace'
 * WriteJournalEntry (idempotency key = workspaceId + version, §20.2/D-07) and
 * runs it through runJournaled with the §20.3 step order:
 *   1. 'write-np-workspace' — idempotent chrome.storage.local.set of the
 *      versioned active-fields snapshot (safe on replay: an upsert of the same
 *      version is a no-op-by-key, T-2-04-03)
 *   2. 'emit-workspace-updated' — BroadcastBus WORKSPACE_UPDATED (reuses the
 *      WorkspaceSync.publishSnapshot shape: { state, from })
 * Entry persistence lands in WriteJournalDB via persistJournalEntry. Never
 * throws to the caller (Golden Rule 9) — runJournaled rethrows after rollback,
 * so this catches and debugLogs.
 */
async function journaledUpdateWorkspace(ws: WorkspaceState): Promise<void> {
  const entry: WriteJournalEntry = {
    id: crypto.randomUUID(),
    operation: 'update-workspace',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
    targetIds: { workspaceId: ws.workspaceId, version: String(ws.version) },
    // CR-01: the D-18 active-field snapshot is persisted IN the entry so crash
    // recovery restores the INTENDED content — never a version-only fabrication
    // built from whatever local state a fresh context happens to hold.
    payload: pickActive(ws),
    steps: [],
  };
  const steps: JournalStep[] = [
    {
      name: 'write-np-workspace',
      apply: async () => {
        await chrome.storage.local.set({ [NP_WORKSPACE_KEY]: pickActive(ws) });
      },
      rollback: async () => {
        // The prior snapshot is not stored in the journal; version-LWW governs
        // convergence, so rollback is a no-op (the failed write never becomes
        // the winning version).
      },
    },
    {
      name: 'emit-workspace-updated',
      apply: async () => {
        broadcastBus.emit(MessageType.WORKSPACE_UPDATED, {
          state: ws,
          from: ws.activeSurface,
        });
      },
      rollback: async () => {
        // Broadcast is fire-and-forget; a rolled-back write emits no further
        // snapshots (receivers LWW-reject stale versions).
      },
    },
  ];
  try {
    await runJournaled(entry, steps, persistJournalEntry);
  } catch (err) {
    debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'journaled workspace write failed', {
      error: err instanceof Error ? err : undefined,
      module: 'WorkspaceStore',
    });
  }
}

type OnChangedListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

// remove-then-add keeps exactly ONE active listener per chrome instance (T-1-11)
// while surviving a chrome mock swap (fakeBrowser.reset() in tests clears all
// listeners — a plain boolean flag would leak the registration state).
let onChangedListener: OnChangedListener | null = null;

export interface WorkspaceStoreShape {
  workspace: WorkspaceState;
  isReady: boolean;
  /** Hydrate np_workspace, fall back to §21.5 defaults, and wire the onChanged sync listener. */
  init(): Promise<void>;
  /** Activate the surface: set activeSurface, bump version, write storage. */
  start(surface: ActiveSurface): Promise<void>;
  /** Detach the storage listener and mark the store inactive. */
  stop(): void;
  /** Read-only copy of the current workspace (WORKSPACE_SNAPSHOT). */
  snapshot(): WorkspaceState;
  /** Immer-style mutation — bump version and write storage on every change. */
  update(fn: (draft: WorkspaceState) => WorkspaceState | void): void;
  /** Set the active surface through update() (D-18 active field). */
  setActiveSurface(surface: ActiveSurface): void;
  /** Set or clear the opened standalone tab id (D-18 active field). */
  setOpenedStandaloneTabId(id?: number): void;
  /**
   * D-07 crash recovery: replay WriteJournalDB entries left pending/applying by
   * a mid-write crash. Workspace-scoped (WR-10) — a recovered write for a
   * different workspaceId is skipped; unknown operation values are
   * skipped-and-logged, never thrown (forward compat). Invoked at the end of
   * init().
   */
  recoverWorkspaceJournal(): Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStoreShape>()((set, get) => ({
  workspace: defaultState(),
  isReady: false,

  init: async () => {
    let ws: WorkspaceState = defaultState();
    try {
      const stored = await chrome.storage.local.get(NP_WORKSPACE_KEY);
      const sanitized = sanitizeStored(stored.np_workspace);
      if (sanitized !== null) ws = { ...ws, ...sanitized };
      debugLog(ERROR_CODES.WORKSPACE_INIT, 'workspace hydrated from np_workspace', {
        silent: true,
        module: 'WorkspaceStore',
      });
    } catch (err) {
      // Never throw (Golden Rule 9): read failures fall back to defaults.
      debugLog(ERROR_CODES.WORKSPACE_INIT, 'read failed; falling back to defaults', {
        error: err instanceof Error ? err : undefined,
        module: 'WorkspaceStore',
      });
    }
    set({ workspace: ws, isReady: true });

    // chrome.storage.onChanged — same-workspace foreign-surface writes propagate
    // with version-LWW (M.3 scope gate, WR-10).
    const handleChanged: OnChangedListener = (changes, area) => {
      if (area !== 'local') return;
      const change = changes[NP_WORKSPACE_KEY];
      if (change === undefined) return;
      const incoming = sanitizeStored(change.newValue);
      if (incoming === null) return; // T-1-13: never merge raw storage
      const local = get().workspace;
      // M.3 workspace scope gate (WR-10) — a snapshot from a DIFFERENT workspace
      // (another window's workspaceId) is never adopted. Must agree with
      // WorkspaceSync.handleRemoteUpdate: shape-check → sanitizeStored →
      // workspaceId gate → version-LWW, so both inbound paths reject foreign
      // snapshots at the same point.
      if (incoming.workspaceId !== local.workspaceId) {
        debugLog(ERROR_CODES.STORE_SYNC, 'np_workspace change ignored (foreign workspace)', {
          silent: true,
          module: 'WorkspaceStore',
        });
        return;
      }
      if (incoming.version !== undefined && incoming.version > local.version) {
        // LWW adoption — merges the active fields; inert fields stay untouched.
        set({ workspace: { ...local, ...incoming } });
        debugLog(ERROR_CODES.STORE_SYNC, 'foreign np_workspace write adopted', {
          silent: true,
          module: 'WorkspaceStore',
        });
      } else {
        debugLog(ERROR_CODES.STORE_SYNC, 'np_workspace change ignored (LWW)', {
          silent: true,
          module: 'WorkspaceStore',
        });
      }
    };
    if (onChangedListener !== null) {
      chrome.storage.onChanged.removeListener(onChangedListener);
    }
    onChangedListener = handleChanged;
    chrome.storage.onChanged.addListener(handleChanged);

    // D-07: replay any journal entry left pending/applying by a mid-write crash
    // (atomic-on-recovery). Runs AFTER the listener is wired so a replayed write
    // propagates like any other same-workspace write.
    await get().recoverWorkspaceJournal();
  },

  start: async (surface) => {
    const next: WorkspaceState = {
      ...get().workspace,
      activeSurface: surface,
      version: get().workspace.version + 1,
      updatedAt: Date.now(),
    };
    set({ workspace: next, isReady: true });
    await journaledUpdateWorkspace(next);
    debugLog(ERROR_CODES.WORKSPACE_START, `workspace started on ${surface}`, {
      silent: true,
      module: 'WorkspaceStore',
    });
  },

  stop: () => {
    if (onChangedListener !== null) {
      chrome.storage.onChanged.removeListener(onChangedListener);
      onChangedListener = null;
    }
    set({ isReady: false });
    debugLog(ERROR_CODES.WORKSPACE_STOP, 'workspace stopped', {
      silent: true,
      module: 'WorkspaceStore',
    });
  },

  snapshot: () => {
    debugLog(ERROR_CODES.WORKSPACE_SNAPSHOT, 'workspace snapshot taken', {
      silent: true,
      module: 'WorkspaceStore',
    });
    return { ...get().workspace };
  },

  update: (fn) => {
    const next = produce(get().workspace, fn);
    const bumped: WorkspaceState = {
      ...next,
      version: get().workspace.version + 1,
      updatedAt: Date.now(),
    };
    set({ workspace: bumped });
    void journaledUpdateWorkspace(bumped);
  },

  setActiveSurface: (surface) => {
    get().update((draft) => {
      draft.activeSurface = surface;
    });
  },

  setOpenedStandaloneTabId: (id) => {
    get().update((draft) => {
      draft.openedStandaloneTabId = id;
    });
  },

  recoverWorkspaceJournal: async () => {
    try {
      // recoverJournal replays only 'pending'/'applying' entries (O.11 verbatim);
      // the replay below applies the D-07 consumer gates (scope + known-op).
      await recoverJournal(loadPendingEntries, async (entry) => {
        const local = get().workspace;
        // D-07 forward-compat (T-2-04-02): an unknown operation value is
        // skipped-and-logged, never thrown — a future-version entry cannot
        // brick startup.
        if (
          entry.operation !== 'update-workspace' &&
          entry.operation !== 'restore-notes-batch'
        ) {
          debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'journal replay skipped (unknown operation)', {
            silent: true,
            module: 'WorkspaceStore',
          });
          return;
        }
        if (entry.operation === 'restore-notes-batch') {
          // WR-02: full-vault restore recovery — re-run the retained per-group
          // merges from the entry's OWN payload (additive + idempotent, D-18),
          // then mark completed (replay-once, mirroring the workspace path). A
          // mid-restore crash can no longer silently drop un-merged groups.
          await replayRestoreEntry(entry);
          entry.status = 'completed';
          await persistJournalEntry(entry);
          debugLog(ERROR_CODES.WORKSPACE_SYNC, 'restore-notes-batch entry replayed', {
            silent: true,
            module: 'WorkspaceStore',
          });
          return;
        }
        // M.3 workspace scope gate (WR-10 / D-07) — a recovered write for a
        // DIFFERENT workspaceId can never contaminate this workspace (T-2-04-01).
        // Same guard as the onChanged handler: shape-check → scope gate → LWW.
        if (entry.targetIds?.workspaceId !== local.workspaceId) {
          debugLog(ERROR_CODES.STORE_SYNC, 'journal replay skipped (foreign workspace)', {
            silent: true,
            module: 'WorkspaceStore',
          });
          return;
        }
        // Re-apply the journaled write (idempotent versioned upsert, T-2-04-03):
        // the entry carries its OWN persisted snapshot (CR-01) — replay applies
        // that content, shape-checked through sanitizeStored, instead of a
        // version-only fabrication from local state. A legacy entry without a
        // payload falls back to the version-bump convergence. If storage
        // already carries >= the entry version the upsert is a no-op-by-key.
        const targetVersion = Number(entry.targetIds?.version);
        if (Number.isFinite(targetVersion) && targetVersion > local.version) {
          const snapshot = sanitizeStored(entry.payload);
          const converged: WorkspaceState =
            snapshot !== null
              ? { ...local, ...snapshot }
              : { ...local, version: targetVersion, updatedAt: Date.now() };
          set({ workspace: converged });
          await chrome.storage.local.set({ [NP_WORKSPACE_KEY]: pickActive(converged) });
          debugLog(ERROR_CODES.WORKSPACE_SYNC, 'journal entry replayed', {
            silent: true,
            module: 'WorkspaceStore',
          });
        }
        // Mark completed so the next recovery pass skips it (replay-once).
        entry.status = 'completed';
        await persistJournalEntry(entry);
      });
    } catch (err) {
      debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'journal recovery failed', {
        error: err instanceof Error ? err : undefined,
        module: 'WorkspaceStore',
      });
    }
  },
}));
