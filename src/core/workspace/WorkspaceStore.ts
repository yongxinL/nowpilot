import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createInitialWorkspaceState, type ActiveSurface, type WorkspaceState } from './WorkspaceState';

export type { ActiveSurface, TabContext, WorkspaceState } from './WorkspaceState';

/**
 * The stale prototype workspace key and its removal-only helper live in an
 * import-free module so the background service worker can delete the blob
 * without pulling this store's zustand/immer/zod graph into its bundle.
 */
export { LEGACY_WORKSPACE_STORAGE_KEY, deleteLegacyWorkspaceBlob } from './legacyWorkspaceBlob';

/**
 * The canonical D-12 writer states, using the frozen vocabulary — Phase 2's
 * election populates them. Phase 1 never leaves `primary`.
 *
 * `mirror | election-pending | handoff-pending | handoff-failed |
 * writer-unavailable` are the mirror-side states: they describe a surface that
 * is not the authoritative writer. Nothing in Phase 1 transitions into any of
 * them.
 */
export type WorkspaceMirrorState =
  | 'mirror'
  | 'election-pending'
  | 'handoff-pending'
  | 'handoff-failed'
  | 'writer-unavailable';

export type WorkspaceWriterState = 'primary' | WorkspaceMirrorState;

/** Runtime membership of the writer-state contract. */
export const WORKSPACE_WRITER_STATES: readonly WorkspaceWriterState[] = [
  'primary',
  'mirror',
  'election-pending',
  'handoff-pending',
  'handoff-failed',
  'writer-unavailable',
];

/**
 * The **Phase-1 writer adapter** (D-12).
 *
 * This is the surface reporting that it is writable — it is NOT a completed
 * writer election. It reports no election result, no writer epoch, no
 * authoritative writer identity, no persistence acknowledgement and no
 * successful demotion, and Phase 1 has no code path that transitions into
 * `mirror`. Phase 2 replaces this adapter with authoritative election state
 * (CAS + heartbeat over the writer channel) and only then may a surface render
 * read-only mirroring.
 */
export const PHASE1_WRITER_STATE: WorkspaceWriterState = 'primary';

/** Phase-1 adapter: the current surface is writable. Not an election result. */
export function isPrimaryWriter(): boolean {
  return PHASE1_WRITER_STATE === 'primary';
}

/** True for every mirror-side state; Phase 1 always reports `false`. */
export function isMirrorState(state: WorkspaceWriterState): state is WorkspaceMirrorState {
  return state !== 'primary';
}

interface WorkspaceActions {
  setWorkspaceId: (id: string) => void;
  setConversationId: (id: string | null) => void;
  setActiveSurface: (surface: ActiveSurface) => void;
  setOpenedStandaloneTabId: (tabId: number | null) => void;
  reset: () => void;
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

/**
 * The workspace store (D-11, D-14).
 *
 * **No persistence.** Phase 1 writes no workspace state to chrome.storage.*,
 * IndexedDB, `localStorage` or `sessionStorage`: there is no persist middleware
 * here, no storage key and no temporary Phase-1 key. Only the authorised Phase-1
 * producers are exposed as mutators — `workspaceId`, `conversationId`,
 * `activeSurface` and `openedStandaloneTabId` (plus the shape version and the
 * write counter those writes bump). The later-phase fields
 * (`activeProvider`, `selectedModel`, `pinnedTabs`, `currentPageContext`,
 * `selectedNotes`, `activeAddonContext`, `activeSkillRun`) have no authoring
 * API at all: a raw model selector must not be reintroduced (DEC-HTML-01), and
 * `pinnedTabs` / `selectedNotes` stay empty rather than being filled with
 * synthetic data.
 *
 * Every mutator bumps `version` (the monotonic write counter Phase 2's
 * election reads) and `updatedAt` (staleness).
 */
export const useWorkspaceStore = create<WorkspaceStore>()(
  immer((set) => ({
    ...createInitialWorkspaceState(),

    setWorkspaceId: (id: string) =>
      set((state) => {
        state.workspaceId = id;
        state.version += 1;
        state.updatedAt = Date.now();
      }),

    setConversationId: (id: string | null) =>
      set((state) => {
        state.conversationId = id;
        state.version += 1;
        state.updatedAt = Date.now();
      }),

    setActiveSurface: (surface: ActiveSurface) =>
      set((state) => {
        state.activeSurface = surface;
        state.version += 1;
        state.updatedAt = Date.now();
      }),

    setOpenedStandaloneTabId: (tabId: number | null) =>
      set((state) => {
        state.openedStandaloneTabId = tabId;
        state.version += 1;
        state.updatedAt = Date.now();
      }),

    reset: () =>
      set(() => ({
        ...createInitialWorkspaceState(),
      })),
  })),
);
