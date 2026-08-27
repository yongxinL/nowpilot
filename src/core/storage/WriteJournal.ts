/**
 * WriteJournal — Phase 2 crash-safe journaling primitive.
 *
 * Implements the spec Appendix O.11 shape verbatim:
 *   - JournalStep { name, apply, rollback }
 *   - runJournaled(entry, steps, persist) — drives pending → applying
 *     → completed; rolls back on step failure (rolled-back + rethrows).
 *   - recoverJournal(load, replay) — replays pending/applying entries.
 *
 * The 11-op union is declared once, in `@/types/storage` (D-32
 * declare-now; this file re-exports the type so downstream callers can
 * import from the journal home if they prefer). Only `update-workspace`
 * has a registered JournalStep implementation in Phase 2.
 *
 * Architectural contract (D-31, D-32, D-33, D-34):
 *   - Entries persist in WriteJournalDB (NOT chrome.storage.session) so
 *     recovery survives SW restarts.
 *   - Entries are metadata-only (no message bodies — D-33).
 *   - The journal-entry write bypasses the D-22 debounce (D-34). The
 *     np_workspace data write stays on the debounced adapter; the
 *     journal step invokes the debounced inner.setItem directly so
 *     coalescing semantics are preserved.
 *   - recoverJournal callers are responsible for isSupportedOperation
 *     gating (D-32 replay contract) — no placeholder handlers are
 *     registered for the remaining 10 ops.
 *   - This module adds no timer (D-26 — WorkspaceElection owns the
 *     only 3 s tick).
 *   - No new `@ts-expect-error NP-STRICT` markers (Pitfall 9 ceiling
 *     holds at 0; verified by Phase-2 gate).
 *
 * Reference: PRODUCT_SPEC_v0_1.md Appendix O.11 + §20.3 (operations
 * + ordering); 02-RESEARCH.md lines 262-331 (verbatim reference +
 * declare-now op union).
 */

import { debugLog } from '../log/debugLog';
import type {
  WriteJournalEntry,
  WriteJournalOperation,
} from '../../types/storage';
import { openChatHistoryDB } from './ChatHistoryDB';
import type { ChatHistoryMessage } from './ChatHistoryDB';

// Re-export the union so downstream consumers can import from the
// journal home (D-32 declare-now). The canonical declaration lives in
// `@/types/storage` per A4.
export type { WriteJournalOperation } from '../../types/storage';

/**
 * O.11 JournalStep — apply MUST be idempotent (safe to run twice on
 * replay after a crash). The §20.3 ordering for update-workspace is:
 *   1. create entry (status='pending')  — done by the caller
 *   2. write chrome.storage.local.np_workspace  — 'write-np-workspace' step
 *   3. emit BroadcastBus WORKSPACE_UPDATED  — 'emit-workspace-updated' step
 *   4. mark entry status='completed'  — done by runJournaled
 */
export interface JournalStep {
  name: string;
  apply(): Promise<void>;
  rollback(): Promise<void>;
}

// --- Module-level steps registry --------------------------------------------
//
// Phase 2 registers ONLY `update-workspace` (D-32). The remaining 10
// operations are declared (in `@/types/storage`) for type fidelity but
// have no implementation — recoverJournal callers MUST gate on
// `isSupportedOperation()` and skip unsupported entries with a debugLog
// instrumentation line (see test 4).

const journalStepsRegistry = new Map<WriteJournalOperation, JournalStep[]>();

/**
 * Register the step list for an operation. Subsequent calls replace
 * the prior list (intentional — tests use this to inject custom
 * failure-mode steps).
 */
export function registerJournalSteps(
  operation: WriteJournalOperation,
  steps: JournalStep[],
): void {
  journalStepsRegistry.set(operation, steps);
}

/**
 * Read the registered steps for an operation (or undefined if none).
 * Used by the boot recovery wiring (plan 02-07) to replay
 * pending/applying entries.
 */
export function getJournalSteps(operation: WriteJournalOperation): JournalStep[] | undefined {
  return journalStepsRegistry.get(operation);
}

/**
 * D-32 replay contract — true iff `operation` has a registered step
 * list. The boot wiring (plan 02-07) uses this to skip unsupported
 * entries with debugLog instrumentation rather than throwing.
 */
export function isSupportedOperation(operation: WriteJournalOperation): boolean {
  return journalStepsRegistry.has(operation);
}

/**
 * O.11 — drive the entry through `steps`, transitioning
 * pending → applying → completed. On step failure, rolls back the
 * already-completed steps in reverse order, marks the entry
 * rolled-back, persists, and rethrows.
 *
 * Side effects on `entry`: mutates status, attempts, steps[] in place.
 * Persistence is delegated to the caller-supplied `persist` callback so
 * the journal stays decoupled from WriteJournalDB / chrome.storage
 * choice (the journalingAdapter passes the IDB put here in Phase 2).
 *
 * Error semantics:
 *   - The first step failure triggers `debugLog('WRITE_JOURNAL_FAILED', ...)`.
 *   - Each rollback failure triggers `debugLog('WRITE_JOURNAL_ROLLBACK_FAILED', ...)`
 *     and does NOT mask the original error (the original throw is the
 *     authoritative outcome per O.11 verbatim).
 */
export async function runJournaled(
  entry: WriteJournalEntry,
  steps: JournalStep[],
  persist: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  entry.status = 'applying';
  entry.attempts += 1;
  await persist(entry);

  const done: JournalStep[] = [];
  try {
    for (const s of steps) {
      await s.apply();
      entry.steps.push({ name: s.name, status: 'completed' });
      done.push(s);
      await persist(entry);
    }
    entry.status = 'completed';
    await persist(entry);
  } catch (e) {
    const originalMessage = e instanceof Error ? e.message : String(e);
    debugLog('WRITE_JOURNAL_FAILED', 'rolling back', {
      id: entry.id,
      step: done.at(-1)?.name,
    });
    for (const s of done.reverse()) {
      try {
        await s.rollback();
      } catch (r) {
        debugLog(
          'WRITE_JOURNAL_ROLLBACK_FAILED',
          r instanceof Error ? r.message : String(r),
          { id: entry.id },
        );
      }
    }
    entry.status = 'rolled-back';
    await persist(entry);
    // Restore error message context (the rollback failures are
    // surfaced via debugLog only; the original error is rethrown).
    throw e instanceof Error ? e : new Error(originalMessage);
  }
}

/**
 * O.11 — replay every entry whose status is `pending` or `applying`.
 * The caller supplies the `load` (read all entries) and `replay`
 * (apply registered steps + runJournaled) functions so the journal
 * stays decoupled from the persistence backend.
 *
 * The replay function is responsible for the D-32 skip-with-debugLog
 * behavior for unsupported operations; recoverJournal itself is
 * agnostic.
 */
export async function recoverJournal(
  load: () => Promise<WriteJournalEntry[]>,
  replay: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  const entries = await load();
  for (const e of entries) {
    if (e.status === 'pending' || e.status === 'applying') {
      await replay(e);
    }
  }
}

/**
 * Factory — JournalStep[] builder for the `update-workspace` operation
 * (O.11 §20.3 ordering verbatim). The builder closes over the injected
 * `write` / `remove` / `emit` dependencies so the journalingAdapter
 * (plan 02-07 wiring) can call it with `(name, value)` at persist time.
 *
 * The factory pattern (curried `(name, value) => JournalStep[]`) keeps
 * the registered step list bound to the write context while still
 * letting runJournaled see stable `step.name` strings for the entry
 * record (D-33 metadata-only requirement).
 *
 * @param deps
 *   - `write(name, value)`: the debounced chromeStorageAdapter.setItem
 *     bound to the np_workspace key. Used by 'write-np-workspace.apply'.
 *   - `remove(name)`: chromeStorageAdapter.removeItem (immediate).
 *     Used by 'write-np-workspace.rollback'.
 *   - `emit(workspaceId, conversationId)`: notifyWorkspaceUpdate.
 *     Used by 'emit-workspace-updated.apply'. No rollback — broadcasts
 *     are fire-and-forget.
 */
export interface WorkspaceWriteStepsDeps {
  write: (name: string, value: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  emit: (workspaceId: string, conversationId: string | null) => void;
}

export type WorkspaceWriteStepsBuilder = (name: string, value: string) => JournalStep[];

export function createWorkspaceWriteSteps(deps: WorkspaceWriteStepsDeps): WorkspaceWriteStepsBuilder {
  return (name: string, value: string): JournalStep[] => {
    // Parse the value once so the emit step has the workspaceId /
    // conversationId available without re-parsing inside apply. If the
    // payload is unparseable, leave defaults — the emit step will
    // broadcast with an empty workspaceId and null conversationId, which
    // surfaces the malformed persist at the broadcast layer (the
    // downstream listener should validate).
    let workspaceId = '';
    let conversationId: string | null = null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (typeof obj.workspaceId === 'string') {
          workspaceId = obj.workspaceId;
        }
        if (typeof obj.conversationId === 'string' || obj.conversationId === null) {
          conversationId = (obj.conversationId as string | null) ?? null;
        }
      }
    } catch {
      // value is not JSON — leave defaults; emit will broadcast empty/null.
    }

    return [
      {
        name: 'write-np-workspace',
        apply: () => deps.write(name, value),
        rollback: () => deps.remove(name),
      },
      {
        name: 'emit-workspace-updated',
        apply: async () => {
          deps.emit(workspaceId, conversationId);
        },
        rollback: async () => undefined,
      },
    ];
  };
}

/**
 * Factory — JournalStep[] builder for the `append-chat-turn` operation
 * (Phase 3 03-07, D-45). Mirrors the `createWorkspaceWriteSteps` curried
 * pattern: injected deps capture the unstable ChatHistoryDB I/O seam while
 * the curried payload carries the per-turn pair.
 *
 * D-45 contract: the completed user/assistant pair is persisted at TURN END
 * via runJournaled — never per chunk (P2 write-rate, T-3-22). Mid-stream
 * chunks live in memory + ChunkBuffer only; an abort drops the partial and
 * this op never runs.
 *
 * Idempotency (replay-safe): message ids are DETERMINISTIC —
 * `turn:${sessionId}:${timestamp}:user|assistant` — so a crash-replay re-put
 * OVERWRITES the same rows instead of duplicating the pair (T-3-23).
 *
 * D-33 discipline: the journal entry itself stays metadata-only; message
 * bodies live in ChatHistoryDB. Rollback deletes the two rows so a
 * rolled-back entry leaves no partial transcript.
 *
 * @param deps
 *   - `putMessage(message)`: idb put into ChatHistoryDB 'messages' store
 *     (v1 schema — role 'user'|'assistant'|'system', metadata
 *     Record<string, unknown>; NO schema change, D-45a stop-condition does
 *     not trigger).
 *   - `deleteMessage(id)`: idb delete by keyPath id — rollback.
 */
export interface ChatTurnStepsDeps {
  putMessage: (message: ChatHistoryMessage) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
}

/** Per-turn payload for the append-chat-turn steps. */
export interface ChatTurnPayload {
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  timestamp: number;
}

export type ChatTurnStepsBuilder = (payload: ChatTurnPayload) => JournalStep[];

export function createChatTurnSteps(deps: ChatTurnStepsDeps): ChatTurnStepsBuilder {
  return (payload: ChatTurnPayload): JournalStep[] => {
    const userMsgId = `turn:${payload.sessionId}:${payload.timestamp}:user`;
    const assistantMsgId = `turn:${payload.sessionId}:${payload.timestamp}:assistant`;
    return [
      {
        name: 'append-chat-turn',
        apply: async () => {
          await deps.putMessage({
            id: userMsgId,
            sessionId: payload.sessionId,
            role: 'user',
            content: payload.userMessage,
            timestamp: payload.timestamp,
            metadata: { source: 'agent-pipeline' },
          });
          await deps.putMessage({
            id: assistantMsgId,
            sessionId: payload.sessionId,
            role: 'assistant',
            content: payload.assistantMessage,
            timestamp: payload.timestamp,
            metadata: { source: 'agent-pipeline' },
          });
        },
        rollback: async () => {
          await deps.deleteMessage(userMsgId);
          await deps.deleteMessage(assistantMsgId);
        },
      },
    ];
  };
}

/**
 * Production deps for `createChatTurnSteps` — bound to the REAL ChatHistoryDB
 * via `openChatHistoryDB()` (idb put/delete into the 'messages' store, v1
 * schema). Each call opens a fresh handle and closes it in `finally` (the
 * idb v8 pattern used across Phase 2 storage modules). Used by the boot
 * registration in `recoverWorkspaceJournal`; the chat hook (03-07 Task 2)
 * builds the same deps when wiring its persistTurn callback.
 */
export function chatTurnStepsDepsFromChatHistoryDB(): ChatTurnStepsDeps {
  return {
    putMessage: async (message: ChatHistoryMessage) => {
      const db = await openChatHistoryDB();
      try {
        await db.put('messages', message);
      } finally {
        db.close();
      }
    },
    deleteMessage: async (id: string) => {
      const db = await openChatHistoryDB();
      try {
        await db.delete('messages', id);
      } finally {
        db.close();
      }
    },
  };
}

/**
 * Dependencies for `recoverWorkspaceJournal` — the boot crash-recovery path.
 * Each field is injected so the helper stays decoupled from the specific
 * chrome.storage adapter / WriteJournalDB handle / broadcast surface.
 *
 * CR-01 fix contract: recovery must re-apply the CURRENT stored np_workspace
 * value (via `readCurrentWorkspace`), never reconstruct a value from the
 * metadata-only `WriteJournalEntry` fields (those carry no workspaceId /
 * conversationId — D-33).
 */
export interface RecoverWorkspaceDeps {
  /** Read all journal entries (bound to WriteJournalDB.getAll('entries')). */
  loadEntries: () => Promise<WriteJournalEntry[]>;
  /** Read the CURRENT np_workspace blob (bound to chromeStorageAdapter.getItem). */
  readCurrentWorkspace: () => Promise<string | null>;
  /** Write np_workspace (bound to chromeStorageAdapter.setItem — debounced). */
  write: (name: string, value: string) => Promise<void>;
  /** Remove np_workspace (bound to chromeStorageAdapter.removeItem). */
  remove: (name: string) => Promise<void>;
  /** WORKSPACE_UPDATED broadcast publish (bound to notifyWorkspaceUpdate). */
  emit: (workspaceId: string, conversationId: string | null) => void;
  /** Persist a journal entry (bound to WriteJournalDB.put). */
  persistEntry: (e: WriteJournalEntry) => Promise<void>;
}

/**
 * O.11 boot crash-recovery — the REAL production path (CR-01 fix).
 *
 * Replays every pending/applying `update-workspace` entry by RE-APPLYING the
 * CURRENT stored np_workspace blob verbatim, instead of reconstructing a
 * value from `entry.workspaceId` / `entry.conversationId` (which never exist
 * on the metadata-only WriteJournalEntry — D-33). The prior inline boot
 * replay's `?? ''` / `?? null` fallbacks overwrote np_workspace with an empty
 * placeholder on every crash recovery; this helper eliminates that data-loss
 * vector.
 *
 * Two compounding defects are fixed here:
 *   (a) value is re-applied from storage, not reconstructed from absent fields.
 *   (b) the `update-workspace` journal steps are registered at boot (idempotent
 *       registry set), so `isSupportedOperation('update-workspace')` returns
 *       true and recovery actually replays (previously nothing registered them
 *       in production, so the D-32 gate always skipped).
 */
export async function recoverWorkspaceJournal(deps: RecoverWorkspaceDeps): Promise<void> {
  // 1. FIRST register the update-workspace steps so the D-32 gate passes in
  //    production (CR-01 defect b). Idempotent — the registry Map replaces
  //    the prior list on repeated calls. The initial '' value is irrelevant
  //    for the registry; each replayed entry builds its own steps with the
  //    current value below.
  registerJournalSteps(
    'update-workspace',
    createWorkspaceWriteSteps({
      write: deps.write,
      remove: deps.remove,
      emit: deps.emit,
    })('np_workspace', ''),
  );

  // 2. Register the append-chat-turn steps alongside (03-07 Task 1, mirror
  //    of the CR-01 pattern) so `isSupportedOperation('append-chat-turn')`
  //    returns true for the D-32 replay gate. The registered list is bound
  //    to the real ChatHistoryDB; a boot replay of a pending append-chat-turn
  //    entry does NOT re-apply (the metadata-only entry carries no message
  //    bodies — D-33 — so the pair cannot be rebuilt; the idempotent
  //    deterministic-id write makes re-application unnecessary, see the
  //    replay branch below).
  registerJournalSteps('append-chat-turn', createChatTurnSteps(chatTurnStepsDepsFromChatHistoryDB())({
    sessionId: '',
    userMessage: '',
    assistantMessage: '',
    timestamp: 0,
  }));

  // 3. Replay every pending/applying entry.
  await recoverJournal(deps.loadEntries, async (entry) => {
    // D-32 replay contract — the boot path re-applies ONLY update-workspace.
    // Unsupported ops are skipped with debugLog (existing behavior); a
    // registered-but-non-workspace op like 'append-chat-turn' is ALSO skipped
    // here: its journal entry is metadata-only (D-33) so the pair cannot be
    // rebuilt, and the deterministic-id write means the rows either already
    // exist (crash after apply) or the turn is dropped (crash before) — both
    // consistent with the D-45 best-effort journaled-append contract.
    if (entry.operation !== 'update-workspace') {
      debugLog('WRITE_JOURNAL_REPLAY_SKIP', `op ${entry.operation} not replayed at boot`, {
        id: entry.id,
      });
      return;
    }

    // Read the CURRENT value (CR-01 fix — never reconstruct from entry fields).
    const current = await deps.readCurrentWorkspace();
    const value =
      current !== null ? current : JSON.stringify({ workspaceId: '', conversationId: null });

    // Build per-entry steps with the CURRENT value.
    const steps = createWorkspaceWriteSteps({
      write: deps.write,
      remove: deps.remove,
      emit: deps.emit,
    })('np_workspace', value);

    await runJournaled(entry, steps, deps.persistEntry);
  });
}

// --- Test seam --------------------------------------------------------------

export const __test__ = {
  /** Reset the module-level journal steps registry (tests). */
  resetJournalRegistry(): void {
    journalStepsRegistry.clear();
  },
  /** Read the registry (tests). */
  getJournalRegistry(): Map<WriteJournalOperation, JournalStep[]> {
    return new Map(journalStepsRegistry);
  },
};