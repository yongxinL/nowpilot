// save.ts — the Flow-3-minus-LLM save seam (D-110, spec 1690).
//
// saveNote = parseLinks → resolveLinks → NotesDB.put → emit('note:saved').
// The LLM pipeline (NoteTagger/NMEM-02/NoteFileSync) is Phase 9 — this is the
// pure save core only. Pitfall 6: EventBus.ts itself is NOT edited — the event
// is a typed constant declared here. The primary-surface write gate lives at
// the UI layer (Phase 15 NotesWorkspace); saveNote is the caller-owned seam.

import type { IDBPDatabase } from 'idb';

import { emit } from '../events/EventBus';
import type { NotesDBV1 } from '../storage/NotesDB';
import type { Note } from '../../types/notes';
import { parseLinks, resolveLinks } from './LinkParser';

/** Typed note:saved event name (Pitfall 6 — declared here, not in EventBus). */
export const NOTE_SAVED_EVENT = 'note:saved';

/** Typed note:saved payload — the only field the subscriber needs. */
export interface NoteSavedPayload {
  noteId: string;
}

/**
 * Flow 3 minus the LLM pipeline (D-110): parse [[Title]] targets, resolve each
 * to a note ID (WIKI-ID-02 tie-break), persist the canonical Note (carrying
 * both links[] and unresolvedLinks[]), then emit note:saved so the
 * MiniSearchIndex subscriber upserts incrementally (D-109).
 *
 * Returns the saved Note + whether the emit reached at least one listener.
 */
export async function saveNote(
  db: IDBPDatabase<NotesDBV1>,
  note: Note,
): Promise<{ note: Note; emitted: boolean }> {
  const targets = parseLinks(note.content);
  const resolution = await resolveLinks(db, targets);
  note.links = resolution.links;
  note.unresolvedLinks = resolution.unresolvedLinks;
  await db.put('notes', note);
  emit(NOTE_SAVED_EVENT, { noteId: note.id } as NoteSavedPayload);
  return { note, emitted: true };
}
