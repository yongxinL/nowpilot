/**
 * NoteMaintenance.ts — staleness detection, orphan detection, and bulk
 * re-analyze (LLM-WIKI-08/09/10, CAT-02/03, SYNC-08, WIKI-ID-04, D-06).
 *
 * Pure-logic service: no storage-area imports, no background jobs.
 * All maintenance is user-triggered (D-06, D-122).
 *
 * Data contracts match UI-SPEC §"NoteMaintenance → Maintenance Surface":
 *   - StalenessResult  — LLM-WIKI-08 staleness detection
 *   - OrphanResult     — LLM-WIKI-09 orphan detection (algorithmic)
 *   - ReanalyzeProgress — LLM-WIKI-10 bulk re-analyze progress
 */

import type { Note } from '../../types/notes';
import { computeBacklinks } from './NoteGraph';
import { NoteTagger } from './NoteTagger';
import { emit } from '../events/EventBus';
import { debugLog } from '../log/debugLog';

// ---------------------------------------------------------------------------
// UI-SPEC data contracts (spec §24 / 09-UI-SPEC)
// ---------------------------------------------------------------------------

/** LLM-WIKI-08 staleness detection result. */
export interface StalenessResult {
  noteId: string;
  isStale: boolean;
  lastGeneratedAt: number;
  noteUpdatedAt: number;
}

/** LLM-WIKI-09 orphan detection result. */
export interface OrphanResult {
  noteId: string;
  isOrphan: boolean;
}

/** LLM-WIKI-10 bulk re-analyze progress (UI-SPEC data contract). */
export interface ReanalyzeProgress {
  current: number;
  total: number;
  phase: 'analyzing' | 'complete' | 'error';
  updatedCount: number;
}

/** Bulk analysis statistics returned by reanalyzeAllNotes. */
export interface BulkAnalysisStats {
  processed: number;
  total: number;
  tagged: number;
  categorized: number;
  summarized: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// LLM-WIKI-02 feature gating
// ---------------------------------------------------------------------------

/** chrome.storage.local key for LLM feature toggles (LLM-WIKI-02). */
export const NP_NOTES_LLM_FEATURES_KEY = 'np_notes_llm_features';

/** NotesLLMFeatures — persisted in chrome.storage.local (UI-SPEC contract). */
export interface NotesLLMFeatures {
  autoTag: boolean;
  autoCategorize: boolean;
  autoSummary: boolean;
  aiSearch: boolean;
}

/** Default: all features enabled (UI-SPEC default). */
const DEFAULT_LLM_FEATURES: NotesLLMFeatures = {
  autoTag: true,
  autoCategorize: true,
  autoSummary: true,
  aiSearch: true,
};

// ---------------------------------------------------------------------------
// Event constants
// ---------------------------------------------------------------------------

/** Emitted via EventBus after each note in bulk re-analyze (SYNC-08). */
const REANALYZE_PROGRESS_EVENT = 'note:reanalyze-progress';

// ---------------------------------------------------------------------------
// LLM feature flag reader (LLM-WIKI-02)
// ---------------------------------------------------------------------------

/**
 * Read LLM feature toggles from chrome.storage.local (LLM-WIKI-02).
 * Falls back to all-default (true) when storage read fails or key absent.
 */
async function readLlmFeatures(): Promise<NotesLLMFeatures> {
  try {
    const result = await chrome.storage.local.get(NP_NOTES_LLM_FEATURES_KEY);
    const stored = result[NP_NOTES_LLM_FEATURES_KEY];
    if (stored && typeof stored === 'object') {
      return { ...DEFAULT_LLM_FEATURES, ...(stored as NotesLLMFeatures) };
    }
  } catch (err) {
    debugLog('NOTE_MAINTENANCE_LLM_FEATURES_READ_FAILED', 'Failed to read LLM features', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return DEFAULT_LLM_FEATURES;
}

// ---------------------------------------------------------------------------
// Staleness detection (LLM-WIKI-08)
// ---------------------------------------------------------------------------

/**
 * Detect staleness (LLM-WIKI-08): note.updated > max(summaryGeneratedAt,
 * tagsGeneratedAt). When no generation timestamp exists (lastGeneratedAt=0),
 * the note is not stale — it has never been analyzed.
 *
 * @param note — the note to check.
 * @returns StalenessResult with isStale flag and timestamps.
 */
export function detectStaleness(note: Note): StalenessResult {
  const lastGeneratedAt = Math.max(
    note.summaryGeneratedAt ?? 0,
    note.tagsGeneratedAt ?? 0,
  );
  const isStale = lastGeneratedAt > 0 && note.updated > lastGeneratedAt;
  return {
    noteId: note.id,
    isStale,
    lastGeneratedAt,
    noteUpdatedAt: note.updated,
  };
}

// ---------------------------------------------------------------------------
// Orphan detection (LLM-WIKI-09)
// ---------------------------------------------------------------------------

/**
 * Detect orphans (LLM-WIKI-09): 0 links + 0 backlinks (algorithmic, no LLM).
 * Uses NoteGraph.computeBacklinks for the reverse index.
 *
 * @param notes — all notes in the vault.
 * @returns Array of OrphanResult (one per note).
 */
export function detectOrphans(notes: Note[]): OrphanResult[] {
  const backlinks = computeBacklinks(notes);
  return notes.map((note) => ({
    noteId: note.id,
    isOrphan: note.links.length === 0 && (backlinks.get(note.id)?.length ?? 0) === 0,
  }));
}

// ---------------------------------------------------------------------------
// Bulk re-analyze (LLM-WIKI-10)
// ---------------------------------------------------------------------------

/**
 * Bulk re-analyze all notes (LLM-WIKI-10). Sequential, user-initiated,
 * with progress callback and abortSignal support. No background jobs (D-06).
 *
 * Gating (LLM-WIKI-02):
 *   - All features false → skip NoteTagger.analyze entirely.
 *   - autoTag=false → tags not counted in stats.
 *   - autoCategorize=false → categoryPath not counted.
 *   - autoSummary=false → summary not counted.
 *
 * @param notes — all notes to re-analyze.
 * @param onProgress — optional callback after each note.
 * @param abortSignal — optional abort signal to stop mid-batch.
 * @returns BulkAnalysisStats with final counts.
 */
export async function reanalyzeAllNotes(
  notes: Note[],
  onProgress?: (stats: BulkAnalysisStats) => void,
  abortSignal?: AbortSignal,
): Promise<BulkAnalysisStats> {
  const features = await readLlmFeatures();
  const skipAll = !features.autoTag && !features.autoCategorize && !features.autoSummary;

  const stats: BulkAnalysisStats = {
    processed: 0,
    total: notes.length,
    tagged: 0,
    categorized: 0,
    summarized: 0,
    errors: 0,
  };

  for (let i = 0; i < notes.length; i++) {
    if (abortSignal?.aborted) break;

    const note = notes[i];

    if (!skipAll) {
      try {
        const result = await NoteTagger.analyze(note, `reanalyze-${note.id}-${i}`);
        if (features.autoTag && result.tags.length > 0) stats.tagged++;
        if (features.autoCategorize && result.categoryPath) stats.categorized++;
        if (features.autoSummary && result.summary) stats.summarized++;
      } catch (err) {
        stats.errors++;
        debugLog('NOTE_MAINTENANCE_ANALYZE_FAILED', 'Re-analyze failed for note', {
          noteId: note.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    stats.processed = i + 1;
    onProgress?.({ ...stats });
    emit<ReanalyzeProgress>(REANALYZE_PROGRESS_EVENT, {
      current: stats.processed,
      total: stats.total,
      phase: 'analyzing',
      updatedCount: stats.tagged + stats.categorized + stats.summarized,
    });
  }

  // Emit completion event.
  emit<ReanalyzeProgress>(REANALYZE_PROGRESS_EVENT, {
    current: stats.processed,
    total: stats.total,
    phase: 'complete',
    updatedCount: stats.tagged + stats.categorized + stats.summarized,
  });

  return stats;
}

// ---------------------------------------------------------------------------
// Object-form namespace export (established pattern)
// ---------------------------------------------------------------------------

/** NoteMaintenance — staleness, orphan, bulk re-analyze facade. */
export const NoteMaintenance = {
  detectStaleness,
  detectOrphans,
  reanalyzeAllNotes,
};
