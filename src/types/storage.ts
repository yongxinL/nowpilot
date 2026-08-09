// src/types/storage.ts — Source: §20.3 WriteJournalOperations (lines 3186-3197,
// verbatim) + Appendix C WriteJournalEntry (lines 4594-4607, verbatim).
// Canonical home per R-1 / Appendix M.1 import path — spec Appendix O.11 imports
// WriteJournalEntry from '@/types/storage' (line 6592). D-05: the 11-op union is
// the locked vocabulary; only 'update-workspace' is wired in Phase 2 — the rest
// are declared-but-unwired (Phase 3/5 extend by adding consumers, never by
// editing the vocabulary, Golden Rule 2).
export type WriteJournalOperation =
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data'
  | 'update-workspace'
  | 'sync-note-file'
  | 'delete-note-file'
  | 'restore-notes-batch';

export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  /**
   * JSON-safe snapshot of the write's payload, retained for crash recovery
   * (CR-01/WR-02 review fix): replay applies the ENTRY's own snapshot rather
   * than fabricating content from local state. Optional — legacy entries
   * without a payload fall back to version-only convergence.
   */
  payload?: unknown;
  steps: Array<{
    name: string;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
  }>;
}
