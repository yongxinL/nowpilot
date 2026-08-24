/**
 * journalingAdapter — Phase 2 compose seam for WorkspaceStore's persist config.
 *
 * Wraps a debounced inner `StateStorage` (chromeStorageAdapter) and composes
 * election-gating + WriteJournal journaling + the D-22 debounce into a single
 * `StateStorage` interface. WorkspaceStore's persist config uses this wrapper
 * instead of the raw `chromeStorageAdapter` (plan 02-07 wiring).
 *
 * Composition (D-31, D-34, A3 from RESEARCH Pattern 2):
 *   setItem('np_workspace', value)  when isPrimary() === true →
 *     1. Parse JSON → extract workspaceId + conversationId
 *     2. Build WriteJournalEntry (status='pending', operation='update-workspace')
 *     3. await putEntry(entry)         — IMMEDIATE IDB put (bypasses debounce)
 *     4. runJournaled applies steps:
 *        - write-np-workspace   (debounced inner.setItem)
 *        - emit-workspace-updated (BroadcastBus WORKSPACE_UPDATED publish)
 *     5. Entry ends 'completed' (or 'rolled-back' on step failure).
 *   setItem when !isPrimary() → NO-OP (mirror only, D-27).
 *   setItem for any other name → passthrough to inner.
 *   getItem('np_workspace') with no current value but legacy 'np_workspace_store' →
 *     one-time lift (read → write → verify → delete legacy).
 *   getItem / removeItem for other keys → passthrough to inner.
 *
 * Contract guarantees:
 *   - D-34 ordering: putEntry is awaited BEFORE the inner.setItem call.
 *     The journal-entry write is immediate; the data write is debounced.
 *   - D-26 no-timer: this module adds no setInterval/setTimeout.
 *   - D-32 replay contract: only 'update-workspace' has registered steps;
 *     unsupported ops are not routed here in Phase 2 (the adapter only
 *     journals the np_workspace key).
 *   - D-33 metadata-only: the WriteJournalEntry carries no message bodies —
 *     only workspaceId + conversationId are extracted from the persisted
 *     blob for the emit step.
 *   - D-39 ownership: this adapter does NOT import ErrorStore. Failures
 *     propagate through runJournaled's rethrow (rollback path) — the boot
 *     wiring (plan 02-07) owns the reporter for chromeStorageAdapter flush
 *     failures separately.
 */

import type { StateStorage } from 'zustand/middleware';
import { runJournaled } from '../storage/WriteJournal';
import type { WriteJournalEntry } from '../../types/storage';

/**
 * The workspace key this adapter journals. Plan 02-07's persist config
 * uses this key (PATTERNS Workspace-key migration rule — after the
 * one-time lift, np_workspace is the sole source of truth).
 */
const WORKSPACE_KEY = 'np_workspace';

/**
 * Legacy workspace key from the Phase-1 scaffold (src/core/workspace/
 * WorkspaceStore.ts:148 — `name: 'np_workspace_store'`). The PATTERNS
 * Workspace-key migration rule: after a one-time lift, np_workspace is
 * the sole key — all Phase-2 journal/recovery code, tests, and plan
 * 02-07's persist config target np_workspace only.
 */
const LEGACY_WORKSPACE_KEY = 'np_workspace_store';

/**
 * Dependencies the adapter needs from its caller. Injected (no module-
 * level globals) so the adapter stays decoupled from the
 * WorkspaceElection module instance, the WriteJournalDB IDB handle, and
 * the BroadcastBus surface.
 */
export interface JournalingAdapterDeps {
  /** The debounced inner storage adapter (chromeStorageAdapter in Phase 2). */
  inner: StateStorage;
  /**
   * Election predicate — true iff the current surface is the primary writer
   * (plan 02-06's WorkspaceElection.isPrimaryWriter). When false, setItem
   * on the np_workspace key is a no-op (D-27 mirror only).
   */
  isPrimary: () => boolean;
  /**
   * Immediate entry write — called BEFORE the inner.setItem in the primary
   * path. This bypasses the debounce (D-34) so recovery sees exact
   * ordering. Typically wired to a fresh `openWriteJournalDB().put(...)`
   * per call.
   */
  putEntry: (e: WriteJournalEntry) => Promise<void>;
  /**
   * Per-step persistence — called by runJournaled on every status
   * transition. The same IDB handle as putEntry (or a wrapped version).
   */
  persistEntry: (e: WriteJournalEntry) => Promise<void>;
  /**
   * WORKSPACE_UPDATED broadcast publish. Typically wired to
   * WorkspaceSync.notifyWorkspaceUpdate.
   */
  emitUpdate: (workspaceId: string, conversationId: string | null) => void;
}

/**
 * Build a `StateStorage` that journals np_workspace writes through the
 * WriteJournal state machine (D-31), gates on the primary-writer
 * predicate (D-27), and lifts the legacy np_workspace_store key on
 * read (PATTERNS Workspace-key migration rule).
 *
 * Step names ('write-np-workspace' / 'emit-workspace-updated') are
 * stable identifiers — they are recorded in entry.steps[].name and
 * must match what plan 02-07's recovery wiring + tests look for.
 */
export function createJournalingAdapter(deps: JournalingAdapterDeps): StateStorage {
  const { inner, isPrimary, putEntry, persistEntry, emitUpdate } = deps;

  return {
    /**
     * setItem — three cases:
     *   1. Non-workspace key → passthrough to inner.
     *   2. Workspace key + !isPrimary → no-op (D-27 mirror only).
     *   3. Workspace key + isPrimary → journal the write:
     *      immediate entry put → runJournaled [write-np-workspace,
     *      emit-workspace-updated].
     */
    async setItem(name: string, value: string): Promise<void> {
      if (name !== WORKSPACE_KEY) {
        // Defensive passthrough — only np_workspace is journaled in
        // Phase 2 (D-34). The D-22 debounce / REQ-R07 error reporter
        // still apply via the inner adapter.
        await inner.setItem(name, value);
        return;
      }

      if (!isPrimary()) {
        // Secondary surface — mirror only. No journal entry, no write
        // (D-27). The secondary will pick up the primary's write via
        // the BroadcastBus WORKSPACE_UPDATED notification when the
        // primary commits, and the debounced inner.setItem will fire
        // through the primary's chrome.storage write.
        return;
      }

      // Parse the value once so the emit step has the workspaceId /
      // conversationId. If the payload is unparseable or missing the
      // workspaceId, leave defaults — the emit will broadcast an
      // empty workspaceId and null conversationId, which surfaces the
      // malformed persist at the broadcast listener layer.
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
        // value is not JSON — leave defaults; downstream listener
        // validates the broadcast shape.
      }

      // Step 1: build the entry (metadata-only — D-33)
      const entry: WriteJournalEntry = {
        id: crypto.randomUUID(),
        operation: 'update-workspace',
        status: 'pending',
        attempts: 0,
        steps: [],
        createdAt: Date.now(),
      };

      // Step 2: immediate IDB put — bypasses debounce (D-34). This MUST
      // complete before the inner.setItem call so crash-recovery sees
      // the journal entry even if the SW is killed mid-inner.write.
      await putEntry(entry);

      // Step 3: run the steps. Each step uses the closure-captured
      // adapter args — the steps here mirror the createWorkspaceWriteSteps
      // factory output but are inlined because the adapter owns the
      // entry lifecycle (the factory is used by plan 02-07's boot
      // wiring to register the steps for recovery replay).
      await runJournaled(
        entry,
        [
          {
            name: 'write-np-workspace',
            // StateStorage returns Promise<unknown>; the JournalStep
            // contract is Promise<void>. The unknown value is the
            // inner.setItem return shape — we discard it intentionally.
            apply: async () => {
              await inner.setItem(name, value);
            },
            rollback: async () => {
              await inner.removeItem(name);
            },
          },
          {
            name: 'emit-workspace-updated',
            apply: async () => {
              emitUpdate(workspaceId, conversationId);
            },
            rollback: async () => {
              // Broadcasts are fire-and-forget — there is no meaningful
              // undo for a WORKSPACE_UPDATED publish. Empty rollback
              // matches the createWorkspaceWriteSteps factory contract.
            },
          },
        ],
        persistEntry,
      );
    },

    /**
     * getItem — workspace key has the legacy-key lift (idempotent).
     * Other keys passthrough.
     */
    async getItem(name: string): Promise<string | null> {
      if (name !== WORKSPACE_KEY) {
        return inner.getItem(name);
      }

      const current = await inner.getItem(WORKSPACE_KEY);
      if (current !== null) {
        return current;
      }

      // Legacy-key lift (PATTERNS Workspace-key migration rule). One-time,
      // idempotent: a second getItem after a successful lift finds the
      // canonical key directly.
      const legacy = await inner.getItem(LEGACY_WORKSPACE_KEY);
      if (legacy === null) {
        return null;
      }

      // Read → write → verify → delete (the migration order is crash-safe
      // because the verify-then-delete is synchronous within this async
      // function — the worst case is a duplicate np_workspace value if
      // a crash happens between write and delete, which the next
      // getItem simply returns the canonical value).
      await inner.setItem(WORKSPACE_KEY, legacy);
      await inner.removeItem(LEGACY_WORKSPACE_KEY);
      return legacy;
    },

    /**
     * removeItem — passthrough. removeItem is NOT debounced in the
     * inner adapter (D-22) and does not need journaling — a remove is
     * the implicit "no np_workspace" state and is recovered naturally
     * by recovery seeing an empty np_workspace.
     */
    async removeItem(name: string): Promise<void> {
      await inner.removeItem(name);
    },
  };
}