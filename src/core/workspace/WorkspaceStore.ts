import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createInitialWorkspaceState, type ActiveSurface, type WorkspaceState } from './WorkspaceState';
// Type-only: the projection consumes 02-06's vocabulary without adding the
// election's zod graph to this module's runtime imports.
import type { ElectionOutcome, WorkspaceCoordinationState } from './WriterElection';

export type { ActiveSurface, TabContext, WorkspaceState } from './WorkspaceState';

/**
 * The stale prototype workspace key and its removal-only helper live in an
 * import-free module so the background service worker can delete the blob
 * without pulling this store's zustand/immer/zod graph into its bundle.
 */
export { LEGACY_WORKSPACE_STORAGE_KEY, deleteLegacyWorkspaceBlob } from './legacyWorkspaceBlob';

/**
 * The canonical D-12 writer states, using the frozen vocabulary — populated by
 * 02-06's authoritative election and by nothing else.
 *
 * `mirror | election-pending | handoff-pending | handoff-failed |
 * writer-unavailable` are the mirror-side states: they describe a surface that
 * is not the authoritative writer. `handoff-pending` / `handoff-failed` are
 * transitions owned by the handoff controllers; `election-pending` is the
 * honest pre-election state and the default, so no surface reports writability
 * before an election resolves.
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

/** True for every mirror-side state. */
export function isMirrorState(state: WorkspaceWriterState): state is WorkspaceMirrorState {
  return state !== 'primary';
}

/**
 * The two authoritative shapes 02-06's election emits: its own typed
 * `ElectionOutcome` (which carries the epoch) and the canonical §20.11
 * `WorkspaceCoordinationState` (which carries the surface identity). Both are
 * accepted, so a surface applies whichever it holds without re-deriving one
 * from the other.
 */
export type WriterElectionSignal = ElectionOutcome | WorkspaceCoordinationState;

/** One surface's writer projection — the frozen state plus what it is based on. */
export interface WriterProjection {
  writerState: WorkspaceWriterState;
  /** The `electedAt` epoch of this surface's last verified authority. */
  writerEpoch: number | null;
  /** The surface holding authority, when one is known. */
  primarySurface: ActiveSurface | null;
}

/**
 * The honest pre-election projection: no authority, no epoch, no primary. This
 * is the store's default, so nothing can report `primary` without an applied
 * election outcome (T-02-36).
 */
export function createInitialWriterProjection(): WriterProjection {
  return { writerState: 'election-pending', writerEpoch: null, primarySurface: null };
}

/**
 * Project one authoritative election signal onto the frozen writer vocabulary.
 *
 * Pure and total: every canonical coordination outcome maps onto exactly one of
 * the six frozen states and no seventh state is introduced.
 *
 *   solo | primary        → `primary`
 *   secondary             → `mirror` while it is mirroring, `election-pending`
 *                           while it is not yet mirroring
 *   election-in-progress  → `election-pending` (the pre-election default)
 *   error                 → `writer-unavailable`, **keeping** the last recorded
 *                           epoch and primary surface: a failed read or a lost
 *                           CAS is not evidence of a demotion, and clearing the
 *                           record here would let an error erase a promotion the
 *                           election never acknowledged.
 *
 * `handoff-pending` / `handoff-failed` are transitions owned by the handoff
 * controllers and are never produced by this projection.
 */
export function projectWriterSignal(
  signal: WriterElectionSignal,
  previous: Pick<WriterProjection, 'writerEpoch' | 'primarySurface'>,
): WriterProjection {
  if ('state' in signal) {
    switch (signal.state) {
      case 'solo':
        return {
          writerState: 'primary',
          writerEpoch: previous.writerEpoch,
          primarySurface: signal.primarySurface,
        };
      case 'primary':
        return {
          writerState: 'primary',
          writerEpoch: previous.writerEpoch,
          primarySurface: signal.surface,
        };
      case 'secondary':
        return {
          writerState: signal.isMirroring ? 'mirror' : 'election-pending',
          writerEpoch: previous.writerEpoch,
          primarySurface: signal.primarySurface,
        };
      case 'election-in-progress':
        return createInitialWriterProjection();
      case 'error':
        return { writerState: 'writer-unavailable', ...previous };
    }
  }

  switch (signal.kind) {
    case 'primary':
      return {
        writerState: 'primary',
        writerEpoch: signal.epoch,
        primarySurface: previous.primarySurface,
      };
    case 'secondary':
      return {
        writerState: 'mirror',
        writerEpoch: previous.writerEpoch,
        primarySurface: signal.current.surface,
      };
    case 'error':
      return { writerState: 'writer-unavailable', ...previous };
  }
}

interface WorkspaceActions {
  setWorkspaceId: (id: string) => void;
  setConversationId: (id: string | null) => void;
  setActiveSurface: (surface: ActiveSurface) => void;
  setOpenedStandaloneTabId: (tabId: number | null) => void;
  /** Apply one authoritative election signal to the writer projection (D-12). */
  applyElectionOutcome: (signal: WriterElectionSignal) => void;
  /** True only while this surface holds a verified election outcome. */
  isAuthoritativeWriter: () => boolean;
  reset: () => void;
}

type WorkspaceStore = WorkspaceState & WriterProjection & WorkspaceActions;

/**
 * The workspace store (D-11, D-14, D-20).
 *
 * **The projection, not a database.** This store holds no persist middleware, no
 * storage key and no durable copy: the workspace key is written by
 * `WorkspacePersistence` (02-06) under the journal, and this module stays a pure
 * in-memory projection of the workspace state plus the writer election. Only the
 * authorised producers are exposed as mutators — `workspaceId`, `conversationId`,
 * `activeSurface` and `openedStandaloneTabId` (plus the shape version and the
 * write counter those writes bump). The later-phase fields
 * (`activeProvider`, `selectedModel`, `pinnedTabs`, `currentPageContext`,
 * `selectedNotes`, `activeAddonContext`, `activeSkillRun`) have no authoring
 * API at all: a raw model selector must not be reintroduced (DEC-HTML-01), and
 * `pinnedTabs` / `selectedNotes` stay empty rather than being filled with
 * synthetic data.
 *
 * Every mutator bumps `version` (the monotonic write counter the election and
 * the persistence ordering read) and `updatedAt` (staleness).
 *
 * The writer projection (`writerState`, `writerEpoch`, `primarySurface`) is a
 * separate axis: it is written only by `applyElectionOutcome` and deliberately
 * does **not** bump `version` — a coordination change is not a workspace write,
 * and the epoch it records is the election's `electedAt`, never a local clock.
 * It defaults to `election-pending`, so no code path reports writability
 * without an applied election outcome (T-02-36).
 */
export const useWorkspaceStore = create<WorkspaceStore>()(
  immer((set, get) => ({
    ...createInitialWorkspaceState(),
    ...createInitialWriterProjection(),

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

    applyElectionOutcome: (signal: WriterElectionSignal) =>
      set((state) => {
        const projection = projectWriterSignal(signal, {
          writerEpoch: state.writerEpoch,
          primarySurface: state.primarySurface,
        });
        state.writerState = projection.writerState;
        state.writerEpoch = projection.writerEpoch;
        state.primarySurface = projection.primarySurface;
      }),

    isAuthoritativeWriter: (): boolean => get().writerState === 'primary',

    reset: () =>
      set(() => ({
        ...createInitialWorkspaceState(),
        ...createInitialWriterProjection(),
      })),
  })),
);
