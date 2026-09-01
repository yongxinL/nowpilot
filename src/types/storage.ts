/**
 * Phase-2 storage type home — WriteJournalEntry and related persisted types.
 *
 * This is the canonical declaration site (per A4: O.11 imports from
 * `@/types/storage`). Plan 02-05's WriteJournal.ts re-exports the union
 * declared here; this file MUST declare the placeholder `WriteJournalOperation`
 * union directly so that this wave-2 plan doesn't forward-reference
 * into wave-3.
 *
 * Reference: PRODUCT_SPEC_v0_1.md Appendix O.11, §20.3 (WriteJournal
 * operations), §15.1 (persisted schema).
 */

import { z } from 'zod';

/**
 * Locked status union for a WriteJournalEntry. Transitions:
 *   pending → applying → completed
 *                ↓
 *           rolled-back (on step failure during runJournaled).
 */
export type WriteJournalEntryStatus =
  | 'pending'
  | 'applying'
  | 'completed'
  | 'rolled-back';

/**
 * Per-step record persisted alongside a WriteJournalEntry. Mirrors
 * Appendix O.11's JournalStep record shape — name + completion state.
 */
export interface WriteJournalStepRecord {
  name: string;
  status: 'completed' | 'rolled-back';
}

/**
 * Full set of WriteJournal operations from spec §20.3. Declared here
 * (plan 02-04) so that this type lives in the shared types barrel;
 * WriteJournal.ts (plan 02-05) imports the union from this file rather
 * than declaring it itself.
 *
 * In Phase 2, only `update-workspace` gets a registered JournalStep
 * implementation per D-32; the rest are placeholders for later phases.
 */
export type WriteJournalOperation =
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'update-memory-record'
  | 'export-data'
  | 'update-workspace'
  | 'sync-note-file'
  | 'delete-note-file'
  | 'restore-notes-batch'
  // Phase 3 (03-07, D-45): additive literal-union extension — the turn-end
  // chat pair append. RESEARCH Open Q1 resolved to option (a): extend the
  // §20.3 union rather than invent a second transcript store (D-45a).
  | 'append-chat-turn'
  // Phase 10 (10-02, MEM-05): procedural experience lifecycle mutation.
  | 'update-procedural-experience';

/**
 * Persisted shape of a WriteJournal entry — Appendix O.11 verbatim.
 * Entries are metadata-only (no message bodies — D-33).
 */
export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: WriteJournalEntryStatus;
  attempts: number;
  steps: WriteJournalStepRecord[];
  createdAt: number;
}

/**
 * Zod schema for WriteJournalEntry — runtime validation at the IDB
 * boundary (CLAUDE.md cross-boundary convention). Schema-validates on
 * hydrate/read; persisted blobs are never trusted without this check.
 */
export const WriteJournalStepRecordSchema = z.object({
  name: z.string().min(1),
  status: z.union([z.literal('completed'), z.literal('rolled-back')]),
});

export const WriteJournalEntryStatusSchema = z.union([
  z.literal('pending'),
  z.literal('applying'),
  z.literal('completed'),
  z.literal('rolled-back'),
]);

export const WriteJournalOperationSchema = z.union([
  z.literal('append-memory-message'),
  z.literal('evict-conversation'),
  z.literal('archive-conversation'),
  z.literal('compact-conversation'),
  z.literal('save-note-with-links'),
  z.literal('update-user-memory'),
  z.literal('update-memory-record'),
  z.literal('export-data'),
  z.literal('update-workspace'),
  z.literal('sync-note-file'),
  z.literal('delete-note-file'),
  z.literal('restore-notes-batch'),
  z.literal('append-chat-turn'),
  z.literal('update-procedural-experience'),
]);

export const WriteJournalEntrySchema = z.object({
  id: z.string().min(1),
  operation: WriteJournalOperationSchema,
  status: WriteJournalEntryStatusSchema,
  attempts: z.number().int().nonnegative(),
  steps: z.array(WriteJournalStepRecordSchema),
  createdAt: z.number().int().nonnegative(),
});