// src/core/storage/NotesDB.ts — the notes + concepts IndexedDB store
// (STORAGE-01). Data models VERBATIM §21.2 (lines 3357-3384); store layout per
// §15.1 (lines 1954-1958). Note content lives HERE — never chrome.storage.local
// (§0.2, Pitfall 4: note bodies belong in IndexedDB, not the 10MB KV quota).
//
// Idb + strict DBSchema typing (RESEARCH Pattern 1): openNotesDB() opens
// 'NotesDB' at DB_VERSION with a NON-throwing upgrade (no migration history
// yet — future schema changes, e.g. Phase 5a's v4 notes_backup_config, extend
// the 02-06 migration registry). §15.1 requires getNoteByTitle() — implemented
// as an in-memory scan (the plan's sanctioned option; no title index exists).
//
// Every catch calls debugLog with a canonical STORE_READ/STORE_WRITE code
// (Golden Rule 9); write paths never throw (PATTERNS Shared Pattern 1).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

/** §21.2 (lines 3358-3383) — verbatim Note (incl. LLM-Wiki optional fields). */
export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
  links: string[]; // resolved wikilinks — target note IDs (atomic-note graph)
  unresolvedLinks: string[]; // wikilink targets with no matching note yet
  source: {
    kind: 'manual' | 'voice' | 'chat-export' | 'template' | 'page-export';
    conversationId?: string;
    templateId?: string;
  };
  aiMeta: {
    suggestedLinks: Array<{ targetId: string; confidence: number; reason: string }>;
    concepts: string[];
    lastWikiRunAt?: number;
  };
  // --- LLM-Wiki fields (§27) ---
  summary?: string; // LLM-generated (LLM-WIKI-03)
  categoryPath?: string; // e.g. "InfoTech/Database/MySQL" (CAT-01)
  summaryGeneratedAt?: number; // staleness detection (LLM-WIKI-08)
  tagsGeneratedAt?: number; // staleness detection (LLM-WIKI-08)
  version: number;
}

/** §21.2 concepts shape (lines 3357-3384 comment): slug-keyed concept node. */
export interface Concept {
  slug: string;
  label: string;
  summary: string;
  noteIds: string[];
  aliases: string[];
  updatedAt: number;
}

/** §15.1 NotesDB stores + indexes (by-updated / by-tags). */
export interface NotesDBSchema extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-updated': number; 'by-tags': string };
  };
  concepts: { key: string; value: Concept };
}

/** Store schema version — bumped by the 02-06 migrator on future changes. */
export const DB_VERSION = 1;

/**
 * Open the NotesDB with a NON-throwing upgrade. Notes keyed by 'id' (with
 * by-updated / by-tags indexes), concepts keyed by 'slug'.
 */
export function openNotesDB(): Promise<IDBPDatabase<NotesDBSchema>> {
  return openDB<NotesDBSchema>('NotesDB', DB_VERSION, {
    upgrade(db) {
      const notes = db.createObjectStore('notes', { keyPath: 'id' });
      notes.createIndex('by-updated', 'updated');
      notes.createIndex('by-tags', 'tags', { multiEntry: true });
      db.createObjectStore('concepts', { keyPath: 'slug' });
    },
  });
}

/** Upsert a note (write path — never throws; STORE_WRITE on failure). */
export async function putNote(db: IDBPDatabase<NotesDBSchema>, note: Note): Promise<void> {
  try {
    await db.put('notes', note);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put note', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
      extra: { noteId: note.id, title: note.title },
    });
  }
}

/** Read a note by id (undefined when absent or on read failure). */
export async function getNote(
  db: IDBPDatabase<NotesDBSchema>,
  id: string,
): Promise<Note | undefined> {
  try {
    return await db.get('notes', id);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get note', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
      extra: { noteId: id },
    });
    return undefined;
  }
}

/** All notes ([] on read failure). */
export async function listNotes(db: IDBPDatabase<NotesDBSchema>): Promise<Note[]> {
  try {
    return await db.getAll('notes');
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to list notes', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
    });
    return [];
  }
}

/** Delete a note by id (write path — never throws; STORE_WRITE on failure). */
export async function deleteNote(db: IDBPDatabase<NotesDBSchema>, id: string): Promise<void> {
  try {
    await db.delete('notes', id);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to delete note', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
      extra: { noteId: id },
    });
  }
}

/**
 * §15.1 getNoteByTitle — exact-title lookup (undefined when absent or on read
 * failure). In-memory scan of the notes store (the plan's sanctioned option;
 * no title index exists in the §15.1 store shape).
 */
export async function getNoteByTitle(
  db: IDBPDatabase<NotesDBSchema>,
  title: string,
): Promise<Note | undefined> {
  try {
    const notes = await db.getAll('notes');
    return notes.find((n) => n.title === title);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get note by title', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
      extra: { title },
    });
    return undefined;
  }
}

/** Upsert a concept (write path — never throws; STORE_WRITE on failure). */
export async function putConcept(db: IDBPDatabase<NotesDBSchema>, concept: Concept): Promise<void> {
  try {
    await db.put('concepts', concept);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_WRITE, 'failed to put concept', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
      extra: { slug: concept.slug },
    });
  }
}

/** Read a concept by slug (undefined when absent or on read failure). */
export async function getConcept(
  db: IDBPDatabase<NotesDBSchema>,
  slug: string,
): Promise<Concept | undefined> {
  try {
    return await db.get('concepts', slug);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to get concept', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
      extra: { slug },
    });
    return undefined;
  }
}

/** All concepts ([] on read failure). */
export async function listConcepts(db: IDBPDatabase<NotesDBSchema>): Promise<Concept[]> {
  try {
    return await db.getAll('concepts');
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'failed to list concepts', {
      error: err instanceof Error ? err : undefined,
      module: 'NotesDB',
    });
    return [];
  }
}
