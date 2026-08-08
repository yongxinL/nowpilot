// src/core/workspace/WorkspaceStore.ts — Source: §21.5 WorkspaceState (lines 3436-3464)
// + Appendix M.1 (lines 5868-5924, adapted to the 01-06 plan contract) + D-18.
// The single source of truth for cross-surface workspace state. Canonical
// durability is a storage ADAPTER that serializes ONLY the D-18 active fields
// (workspaceId / conversationId / activeSurface / openedStandaloneTabId) plus
// version / updatedAt to chrome.storage.local key np_workspace — deliberately NOT
// zustand's storage middleware (Pitfall 7: storage middleware writes localStorage,
// which does not cross surfaces). chrome.storage.onChanged propagates foreign-surface
// writes with version-LWW adoption (T-1-13: stored values are schema-validated
// before merge; unknown keys are never spread raw). Inert WorkspaceState fields
// stay untouched by every mutation (D-18 / T-1-05). Every error path calls
// debugLog with a canonical WORKSPACE_*/STORE_* code and never throws (Golden Rule 9).
import { create } from 'zustand';
import { produce } from 'immer';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
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
 */
function sanitizeStored(value: unknown): Partial<WorkspaceState> | null {
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

/** Write the D-18 active fields through the storage adapter. Never throws. */
async function writeStorage(ws: WorkspaceState): Promise<void> {
  try {
    await chrome.storage.local.set({ [NP_WORKSPACE_KEY]: pickActive(ws) });
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to write np_workspace', {
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

    // chrome.storage.onChanged — foreign-surface writes propagate with version-LWW.
    const handleChanged: OnChangedListener = (changes, area) => {
      if (area !== 'local') return;
      const change = changes[NP_WORKSPACE_KEY];
      if (change === undefined) return;
      const incoming = sanitizeStored(change.newValue);
      if (incoming === null) return; // T-1-13: never merge raw storage
      const local = get().workspace;
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
  },

  start: async (surface) => {
    const next: WorkspaceState = {
      ...get().workspace,
      activeSurface: surface,
      version: get().workspace.version + 1,
      updatedAt: Date.now(),
    };
    set({ workspace: next, isReady: true });
    await writeStorage(next);
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
    void writeStorage(bumped);
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
}));
