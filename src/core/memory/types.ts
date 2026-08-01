import type { ContextItem } from '../context/ContextItem';

/**
 * Retrieval result — discriminated union, never thrown for operational
 * errors (follows the ExtractionResult pattern from Phase 4a).
 */
export type MemoryRetrievalResult =
  | { success: true; items: ContextItem[] }
  | { success: false; error: string; code: 'STORE_ERROR' | 'SCORING_ERROR' };

/**
 * Write result — discriminated union. `WRITE_BOUNDARY_VIOLATION` is emitted
 * by the D-05 guard (AI pipeline may only write working/episodic).
 */
export type MemoryWriteResult =
  | { success: true; recordId: string }
  | {
      success: false;
      error: string;
      code:
        | 'VALIDATION_ERROR'
        | 'NOT_PRIMARY_SURFACE'
        | 'DB_ERROR'
        | 'JOURNAL_ERROR'
        | 'WRITE_BOUNDARY_VIOLATION';
    };

/**
 * Retrieval options — per-turn query plus the model context tier that drives
 * D-09 tier-gating and the D-10 tail size.
 */
export interface RetrievalOptions {
  conversationId: string;
  query: string;
  tier: 'tiny' | 'small' | 'medium' | 'large';
}

/**
 * WriteJournal operation names for memory writes (matches the Phase 2
 * WriteJournalOperation union).
 */
export type MemoryStoreWriteOp = 'update-user-memory' | 'write-preference' | 'compact-conversation';
