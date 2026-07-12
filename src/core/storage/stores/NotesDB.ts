import { getDB } from '../IndexedDBManager';
import { debugLog } from '../../utils/debugLog';

export class NotesDB {
  async createNote(note: {
    id: string;
    title: string;
    content: string;
    created: number;
    updated: number;
    tags: string[];
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('notes_notes', note);
    } catch (err) {
      debugLog('error', 'NotesDB.createNote failed', { error: err });
    }
  }

  async getNote(id: string): Promise<
    | {
        id: string;
        title: string;
        content: string;
        created: number;
        updated: number;
        tags: string[];
      }
    | undefined
  > {
    try {
      const db = await getDB();
      return db.get('notes_notes', id);
    } catch (err) {
      debugLog('error', 'NotesDB.getNote failed', { error: err });
      return undefined;
    }
  }

  async getAllNotes(): Promise<
    Array<{
      id: string;
      title: string;
      content: string;
      created: number;
      updated: number;
      tags: string[];
    }>
  > {
    try {
      const db = await getDB();
      return db.getAll('notes_notes');
    } catch (err) {
      debugLog('error', 'NotesDB.getAllNotes failed', { error: err });
      return [];
    }
  }

  async updateNote(note: {
    id: string;
    title: string;
    content: string;
    created: number;
    updated: number;
    tags: string[];
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('notes_notes', note);
    } catch (err) {
      debugLog('error', 'NotesDB.updateNote failed', { error: err });
    }
  }

  async deleteNote(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('notes_notes', id);
    } catch (err) {
      debugLog('error', 'NotesDB.deleteNote failed', { error: err });
    }
  }

  async createConcept(concept: {
    slug: string;
    label: string;
    description: string;
    linkedNoteIds: string[];
  }): Promise<void> {
    try {
      const db = await getDB();
      await db.put('notes_concepts', concept);
    } catch (err) {
      debugLog('error', 'NotesDB.createConcept failed', { error: err });
    }
  }

  async getConcept(slug: string): Promise<
    | {
        slug: string;
        label: string;
        description: string;
        linkedNoteIds: string[];
      }
    | undefined
  > {
    try {
      const db = await getDB();
      return db.get('notes_concepts', slug);
    } catch (err) {
      debugLog('error', 'NotesDB.getConcept failed', { error: err });
      return undefined;
    }
  }
}

export const notesDB = new NotesDB();
