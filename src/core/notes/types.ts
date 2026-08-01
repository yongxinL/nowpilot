import type { Note } from './NoteSchema';

/**
 * Searchable document shape for the notes MiniSearch index (D-12).
 * `wikilinkTargets` are the raw `[[title]]` targets extracted from content.
 */
export interface NoteIndexDoc {
  id: string;
  title: string;
  content: string;
  tags: string[];
  wikilinkTargets: string[];
  updatedAt: number;
}

/**
 * Discriminated union returned by NotesDB.get() (D-01, D-02).
 */
export type NoteFindResult =
  | { success: true; note: Note }
  | { success: false; error: string; code: 'NOT_FOUND' | 'DB_ERROR' };

/**
 * Discriminated union returned by NotesDB.save()/update() — operational
 * errors are returned, never thrown (UI-SPEC empty/error state contract).
 */
export type NoteSaveResult =
  | { success: true; noteId: string }
  | { success: false; error: string; code: 'VALIDATION_ERROR' | 'DB_ERROR' | 'JOURNAL_ERROR' };

/**
 * Search result contract for downstream UI (UI-SPEC §Data-Type Contracts).
 */
export interface NoteSearchResult {
  noteId: string;
  score: number;
  matchedFields: ('title' | 'content' | 'tags' | 'wikilinkTargets')[];
  /** Text excerpt with query terms wrapped in <mark> highlights. */
  snippet: string;
}
