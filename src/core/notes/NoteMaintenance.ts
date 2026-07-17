import { debugLog } from '../utils/debugLog';
import type { Note, BacklinkEntry } from './LinkParser';
import type { TaggerResult } from './noteTypes';
import { noteTagger } from './NoteTagger';

// ── Types ──

export interface MaintenanceStats {
  totalNotes: number;
  orphanCount: number;
  staleTagsCount: number;
  staleSummaryCount: number;
}

export interface BulkAnalysisResult {
  analyzed: number;
  skipped: number;
  results: Map<string, TaggerResult>;
}

// ── Wikilink regex (same as LinkParser/NoteGraph) ──

const WIKILINK_REGEX = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g;

// ── NoteMaintenance class ──

export class NoteMaintenance {
  /**
   * Detect orphan notes: notes with 0 outgoing wikilinks AND 0 incoming backlinks.
   * A note is orphaned if it links to no other notes AND no other note links to it.
   */
  detectOrphans(
    notes: Note[],
    backlinks: Map<string, BacklinkEntry[]>,
    _allNotes: Note[],
  ): Note[] {
    try {
      return notes.filter((note) => {
        // Check outgoing wikilinks
        const outgoingLinks = this.parseWikilinks(note.content || '');
        const hasOutgoing = outgoingLinks.length > 0;

        // Check incoming backlinks
        const incoming = backlinks.get(note.id);
        const hasIncoming = incoming !== undefined && incoming.length > 0;

        // Orphan if no outgoing AND no incoming
        return !hasOutgoing && !hasIncoming;
      });
    } catch (err) {
      debugLog('error', '[NoteMaintenance] detectOrphans failed', { error: err });
      return [];
    }
  }

  /**
   * Detect stale notes: notes where content was updated after the last LLM analysis.
   * Returns separate arrays for stale tags and stale summaries.
   */
  detectStale(notes: Note[]): { staleTags: Note[]; staleSummary: Note[] } {
    try {
      const staleTags: Note[] = [];
      const staleSummary: Note[] = [];

      for (const note of notes) {
        if (
          note.tagsGeneratedAt !== undefined &&
          note.updated > note.tagsGeneratedAt
        ) {
          staleTags.push(note);
        }
        if (
          note.summaryGeneratedAt !== undefined &&
          note.updated > note.summaryGeneratedAt
        ) {
          staleSummary.push(note);
        }
      }

      return { staleTags, staleSummary };
    } catch (err) {
      debugLog('error', '[NoteMaintenance] detectStale failed', { error: err });
      return { staleTags: [], staleSummary: [] };
    }
  }

  /**
   * Get a quick summary of maintenance stats: total notes, orphan count,
   * notes with stale tags, and notes with stale summaries.
   */
  getMaintenanceStats(
    notes: Note[],
    backlinks: Map<string, BacklinkEntry[]>,
    allNotes: Note[],
  ): MaintenanceStats {
    try {
      const orphans = this.detectOrphans(notes, backlinks, allNotes);
      const { staleTags, staleSummary } = this.detectStale(notes);

      return {
        totalNotes: notes.length,
        orphanCount: orphans.length,
        staleTagsCount: staleTags.length,
        staleSummaryCount: staleSummary.length,
      };
    } catch (err) {
      debugLog('error', '[NoteMaintenance] getMaintenanceStats failed', { error: err });
      return { totalNotes: 0, orphanCount: 0, staleTagsCount: 0, staleSummaryCount: 0 };
    }
  }

  /**
   * Run LLM analysis (tags, category, summary) for all notes that have stale content.
   * Sequential processing per LLM-WIKI-10. Skips notes with unchanged content
   * since the last analysis to avoid unnecessary LLM calls.
   */
  async bulkAnalyze(
    notes: Note[],
    allCategories: string[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<BulkAnalysisResult> {
    const results = new Map<string, TaggerResult>();
    let analyzed = 0;
    let skipped = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];

      // Skip notes with unchanged content since last analysis
      if (
        note.tagsGeneratedAt !== undefined &&
        note.updated <= note.tagsGeneratedAt
      ) {
        skipped++;
        onProgress?.(i + 1, notes.length);
        continue;
      }

      try {
        const result = await noteTagger.analyze(
          { title: note.title, content: note.content },
          allCategories,
        );
        results.set(note.id, result);
        analyzed++;
      } catch (err) {
        debugLog('warn', '[NoteMaintenance] bulkAnalyze failed for note', {
          noteId: note.id,
          error: err,
        });
        // One note failure does not stop the batch per spec
      }

      onProgress?.(i + 1, notes.length);
    }

    return { analyzed, skipped, results };
  }

  /**
   * Parse wikilinks from content (local copy to avoid cross-dependency).
   */
  private parseWikilinks(content: string): Array<{ title: string }> {
    const links: Array<{ title: string }> = [];
    let match: RegExpExecArray | null;
    WIKILINK_REGEX.lastIndex = 0;
    while ((match = WIKILINK_REGEX.exec(content)) !== null) {
      const title = match[1].trim();
      if (title) {
        links.push({ title });
      }
    }
    return links;
  }
}

export const noteMaintenance = new NoteMaintenance();
