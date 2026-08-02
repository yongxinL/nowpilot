import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import { emit } from '../events/EventBus';
import { getNotesDb } from './NotesDB';
import { getNoteGraph } from './NoteGraph';
import { getNoteTagger, type NoteEnrichedEvent } from './NoteTagger';
import type { Note } from './NoteSchema';

/**
 * NoteMaintenance — passive staleness/orphan queries (D-21).
 *
 * UI-driven only: no background monitoring, no EventBus subscriptions.
 * - getStaleNotes(): notes whose enrichment timestamps (tags/summary) are
 *   older than the last edit.
 * - getOrphanNotes(): notes with zero wikilinks AND zero backlinks.
 * - reanalyzeAll(): sequential bulk NoteTagger re-analysis (LLM-WIKI-10);
 *   sequential to avoid rate-limiting the LLM provider.
 */

/** Grace period: a brand-new note edited within this window is not "stale". */
const FRESH_NOTE_GRACE_MS = 60 * 1000;

export interface ReanalyzeResult {
  total: number;
  enriched: number;
  failed: number;
}

export class NoteMaintenance {
  private static _instance: NoteMaintenance | null = null;

  private constructor() {}

  static getInstance(): NoteMaintenance {
    if (!NoteMaintenance._instance) {
      NoteMaintenance._instance = new NoteMaintenance();
    }
    return NoteMaintenance._instance;
  }

  static resetInstance(): void {
    NoteMaintenance._instance = null;
  }

  /**
   * Notes whose enrichment metadata is stale relative to the last edit:
   * `tagsGeneratedAt < updatedAt` OR `summaryGeneratedAt < updatedAt`.
   * Never-enriched notes count as stale only when edited beyond the fresh
   * grace period (avoids flagging brand-new notes).
   */
  async getStaleNotes(): Promise<Note[]> {
    const allNotes = await getNotesDb().getAll();
    return allNotes.filter((note) => {
      const editedRecently = note.updatedAt > note.createdAt + FRESH_NOTE_GRACE_MS;
      const hasTags = note.tagsGeneratedAt !== undefined;
      const hasSummary = note.summaryGeneratedAt !== undefined;

      if (!hasTags && !hasSummary) {
        // Never enriched — stale only if edited after the grace period.
        return editedRecently;
      }

      const staleTags = hasTags ? note.tagsGeneratedAt! < note.updatedAt : false;
      const staleSummary = hasSummary ? note.summaryGeneratedAt! < note.updatedAt : false;
      return staleTags || staleSummary;
    });
  }

  /** Notes with zero wikilinks and zero backlinks (computed, never stored). */
  async getOrphanNotes(): Promise<Note[]> {
    const allNotes = await getNotesDb().getAll();
    const graph = getNoteGraph();
    return allNotes.filter(
      (note) =>
        note.links.length === 0 &&
        graph.getBacklinks(note.id, allNotes).length === 0,
    );
  }

  /**
   * Bulk re-analysis (LLM-WIKI-10): sequential NoteTagger.analyze() over
   * every note — no parallelism (avoids provider rate limits). Successful
   * enrichments emit `note:enriched` so the UI can surface suggestions.
   */
  async reanalyzeAll(adapter: ProviderAdapter): Promise<ReanalyzeResult> {
    const allNotes = await getNotesDb().getAll();
    let enriched = 0;
    let failed = 0;

    for (const note of allNotes) {
      const result = await getNoteTagger().analyze(
        adapter,
        note.id,
        note.content,
        note.version,
      );
      if (!result) {
        failed++;
        continue;
      }
      enriched++;
      emit<NoteEnrichedEvent>('note:enriched', {
        noteId: note.id,
        enrichment: result.enrichment,
        memoryFacts: getNoteTagger().filterMemoryFacts(result.memoryFacts),
      });
    }

    return { total: allNotes.length, enriched, failed };
  }
}

/** Singleton accessor (NoteGraph pattern). */
export function getNoteMaintenance(): NoteMaintenance {
  return NoteMaintenance.getInstance();
}

/** Test isolation: drop the cached singleton. */
export function resetNoteMaintenance(): void {
  NoteMaintenance.resetInstance();
}

/** Module-level singleton instance. */
export const noteMaintenance = getNoteMaintenance();
