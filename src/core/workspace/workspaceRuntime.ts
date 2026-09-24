import { debugLog } from '../log/debugLog';
import {
  readWorkspaceState,
  subscribeToWorkspaceChanges,
  writeWorkspaceState,
} from './WorkspacePersistence';
import { useWorkspaceStore } from './WorkspaceStore';
import { assertActiveWriterStillPrimary } from './WriterElection';
import type { WorkspaceState } from './WorkspaceState';

/**
 * workspaceRuntime — the production call sites for the workspace repository
 * (`WORKSPACE_STORAGE_KEY`, CR-02, §20.3, D2-31, success criterion 4).
 *
 * `WorkspacePersistence` (02-06) owns the journaled, version-ordered read/write
 * path; this module owns the surface composition around it, once per document:
 *
 *   1. **Hydrate before the first election.** The durable copy is read and
 *      installed into `useWorkspaceStore` before this surface elects, so the
 *      surface starts from the persisted identity rather than minting a fresh
 *      one per document (`createInitialWorkspaceState()` runs at module
 *      evaluation, which is how every load previously produced a different
 *      `workspaceId`).
 *   2. **Persist every authorised mutation.** Every store change that moves the
 *      write counter or the staleness marker is written through
 *      `writeWorkspaceState`, which keeps §20.3's order (journal entry → key →
 *      narrow `{workspaceId, conversationId}` signal → completed) and the
 *      strictly-greater version rule. This is the subscriber that turns
 *      `WorkspaceRouter`'s bootstrap/apply mutations (`setWorkspaceId`,
 *      `setConversationId`, `setActiveSurface`, `setOpenedStandaloneTabId`) and
 *      any later authorised mutation into durable state.
 *   3. **Stay behind the election.** Every write first passes
 *      `assertStillPrimary()` against this surface's registered election, so a
 *      superseded (stale) writer can never overwrite the durable copy — the
 *      pre-write gate 02-06's module contract names, and the "only after the
 *      election becomes authoritative" half of D2-34.
 *   4. **Install the opposite surface's updates.** `subscribeToWorkspaceChanges`
 *      delivers a freshly re-read, schema-valid state only when it is newer than
 *      the last version this subscriber saw; it is installed into the projection
 *      when it is strictly newer than the in-memory state, so the narrow signal
 *      (never a state object, D2-31) can move this document forward but never
 *      backwards.
 *
 * ## Ordering rules, and why they are last-write-wins
 *
 *   - **A durable copy is installed only when it is newer than the in-memory
 *     state** (hydration) or at least as new (the rejection path, where the
 *     stored copy wins a tie by `WorkspacePersistence`'s own rule). This keeps
 *     a URL bootstrap this document already applied — a handoff target's
 *     projection — from being rolled back by an older stored copy, while a
 *     genuinely newer stored copy still wins.
 *   - **The in-memory write counter is hydrated from the persisted copy**, so
 *     this surface's next mutation is strictly greater than the stored version
 *     and the monotonic rule cannot reject the opposite surface's writes.
 *   - **Becoming primary is a persistence point.** When the writer projection
 *     transitions to `primary` — the first election or a later promotion after
 *     the previous writer's record went stale (D2-34's successful-handoff
 *     ordering) — the current projection is established durably if the stored
 *     copy is behind it. That is what makes a handoff target's applied
 *     projection survive its own reload.
 *
 * ## Boundaries
 *
 * The runtime writes nothing but the workspace key (through the repository), never
 * publishes a state object (the repository's signal is two identifiers), and
 * holds no durable state of its own: the module-level flags below are per
 * document and reset with the document. Every write resolves a typed result
 * rather than rejecting: a journal/IndexedDB failure in the §19.10
 * blocked/unavailable state is logged with its redacted code and the mutation
 * stays in memory, ready to persist once storage returns (WR-06). `startWorkspaceRuntime` is idempotent
 * for the document (React's double-invoked mount joins the same runtime), and it
 * deliberately has no teardown: the subscriptions are document-lifetime, exactly
 * like the store and the runtime they serve.
 */

let started = false;
/** True while a durable copy is being installed, so the install is not written back. */
let installing = false;
/** Microtask coalescing: one write per burst of store mutations. */
let persistScheduled = false;
/** The last durable write counter this document has seen (`-1` = none seen). */
let durableVersion = -1;
let unsubscribeChanges: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;

/** The redacted reason string for a caught error — never the message. */
function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && name.length > 0) return name;
  }
  return typeof error;
}

/** The projection fields `WorkspaceState` owns — never the actions or the writer axis. */
function snapshot(): WorkspaceState {
  const state = useWorkspaceStore.getState();
  return {
    schemaVersion: state.schemaVersion,
    workspaceId: state.workspaceId,
    conversationId: state.conversationId,
    activeProvider: state.activeProvider,
    selectedModel: state.selectedModel,
    pinnedTabs: state.pinnedTabs,
    currentPageContext: state.currentPageContext,
    selectedNotes: state.selectedNotes,
    activeAddonContext: state.activeAddonContext,
    activeSkillRun: state.activeSkillRun,
    activeSurface: state.activeSurface,
    openedStandaloneTabId: state.openedStandaloneTabId,
    version: state.version,
    updatedAt: state.updatedAt,
  };
}

/** Install a schema-valid state into the projection without bumping the counter. */
function install(state: WorkspaceState): void {
  installing = true;
  try {
    useWorkspaceStore.setState({ ...state });
  } finally {
    installing = false;
  }
  durableVersion = Math.max(durableVersion, state.version);
}

/** Adopt the durable copy per the rule the call site needs (see the module note). */
async function adoptDurableCopy(rule: 'newer' | 'at-least'): Promise<void> {
  const read = await readWorkspaceState();
  if (!read.ok) {
    debugLog(read.code, 'The durable workspace state could not be read', {
      surface: useWorkspaceStore.getState().activeSurface,
    });
    return;
  }

  const current = useWorkspaceStore.getState().version;
  const adopt =
    rule === 'newer' ? read.value.version > current : read.value.version >= current && read.value.version > 0;
  if (!adopt) return;
  install(read.value);
}

/**
 * Write one candidate state through §20.3's journaled path, behind the election
 * gate. On a monotonic rejection the stored copy is adopted: it is the newer
 * truth, and retrying the same version would keep being rejected.
 *
 * Returns true only when the candidate was persisted.
 */
async function attemptWrite(candidate: WorkspaceState): Promise<boolean> {
  const gate = await assertActiveWriterStillPrimary();
  if (!gate.ok) {
    debugLog('WORKSPACE_WRITER_REJECTED', 'The workspace write was held: this surface is not the authoritative writer', {
      code: gate.code,
    });
    return false;
  }

  const written = await writeWorkspaceState(candidate);
  if (written.ok) {
    durableVersion = Math.max(durableVersion, written.value.version);
    return true;
  }

  debugLog(written.code, 'The workspace write was not persisted', {
    version: candidate.version,
  });
  if (written.code === 'WORKSPACE_VERSION_REJECTED') {
    await adoptDurableCopy('at-least');
  }
  return false;
}

/** Persist the current projection (the authorised-mutation path). */
async function persistCurrentState(): Promise<void> {
  await attemptWrite(snapshot());
}

/**
 * Establish this document's projection durably when the stored copy is behind it.
 * Called on every transition into authoritative writer state: the first election
 * and any later promotion (see the module note).
 *
 * A successful write installs the candidate (with the counter it actually
 * persisted) back into the projection, so this document's next mutation is
 * strictly greater than the stored version — the same reason hydration installs
 * the durable counter.
 */
export async function establishWorkspaceIdentity(): Promise<void> {
  const current = snapshot();
  if (durableVersion >= 0 && current.version <= durableVersion) return;

  const candidate: WorkspaceState = {
    ...current,
    version: Math.max(current.version, durableVersion + 1, 1),
  };
  if (await attemptWrite(candidate)) install(candidate);
}

function schedulePersist(): void {
  if (persistScheduled) return;
  persistScheduled = true;
  queueMicrotask(() => {
    persistScheduled = false;
    // Defence (WR-06): `writeWorkspaceState` resolves typed failures, so this
    // catch is unreachable for the expected paths — it exists so an unexpected
    // rejection can never surface as an unhandled one from a microtask.
    void persistCurrentState().catch((error) => {
      debugLog('WORKSPACE_WRITE_FAILED', 'The scheduled workspace write rejected unexpectedly', {
        reason: errorName(error),
      });
    });
  });
}

/**
 * Start the workspace runtime for this document: hydrate the durable copy,
 * subscribe to cross-surface updates, and persist every authorised mutation.
 * Idempotent — the second call (React's development double-effect, or a second
 * mount) joins the running runtime.
 */
export async function startWorkspaceRuntime(): Promise<void> {
  if (started) return;
  started = true;

  await adoptDurableCopy('newer');

  unsubscribeChanges = subscribeToWorkspaceChanges((state) => {
    if (state.version <= useWorkspaceStore.getState().version) return;
    install(state);
  });

  unsubscribeStore = useWorkspaceStore.subscribe((state, previous) => {
    if (installing) return;
    if (state.version !== previous.version || state.updatedAt !== previous.updatedAt) {
      schedulePersist();
      return;
    }
    // A promotion to authority makes this projection the durable one.
    if (state.writerState === 'primary' && previous.writerState !== 'primary') {
      // Defence (WR-06): the establishment write resolves typed failures; the
      // catch only keeps an unexpected rejection from going unhandled.
      void establishWorkspaceIdentity().catch((error) => {
        debugLog('WORKSPACE_WRITE_FAILED', 'The establishment write rejected unexpectedly', {
          reason: errorName(error),
        });
      });
    }
  });
}

/** Test seams. Production code must never import this namespace. */
export const __test__ = {
  reset(): void {
    unsubscribeChanges?.();
    unsubscribeStore?.();
    unsubscribeChanges = null;
    unsubscribeStore = null;
    started = false;
    installing = false;
    persistScheduled = false;
    durableVersion = -1;
  },
  durableVersion(): number {
    return durableVersion;
  },
};
