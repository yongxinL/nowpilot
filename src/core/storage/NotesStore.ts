import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Note } from '../notes/NoteSchema';
import type { NoteSaveResult } from '../notes/types';
import { notesDb } from '../notes/NotesDB';

export interface NotesState {
  ready: boolean;
  /** In-memory notes mirror — source of truth is NotesDB (IndexedDB). */
  notes: Note[];
  /** Load all notes from NotesDB. Errors fall back to empty + ready (no throw). */
  loadNotes: () => Promise<void>;
  /** Delegate to NotesDB.save(); on success sync the local mirror. */
  saveNote: (note: Note) => Promise<NoteSaveResult>;
  /** Delegate to NotesDB.remove(); on success drop from the local mirror. */
  deleteNote: (id: string) => Promise<boolean>;
  /** Reload from NotesDB (cross-surface sync). */
  refreshNotes: () => Promise<void>;
}

export const useNotesStore = create<NotesState>()(
  immer((set, get) => ({
    ready: false,
    notes: [],

    loadNotes: async () => {
      try {
        const all = await notesDb.getAll();
        set((state) => {
          state.notes = all;
          state.ready = true;
        });
      } catch {
        // UI-SPEC empty state: failed loads render 'notes.empty' copy
        set((state) => {
          state.notes = [];
          state.ready = true;
        });
      }
    },

    saveNote: async (note) => {
      const result = await notesDb.save(note);
      if (result.success) {
        set((state) => {
          const idx = state.notes.findIndex((n) => n.id === result.noteId);
          if (idx >= 0) {
            state.notes[idx] = note;
          } else {
            state.notes.push(note);
          }
        });
      }
      return result;
    },

    deleteNote: async (id) => {
      const result = await notesDb.remove(id);
      if (result.success) {
        set((state) => {
          state.notes = state.notes.filter((n) => n.id !== id);
        });
      }
      return result.success;
    },

    refreshNotes: async () => {
      await get().loadNotes();
    },
  })),
);
