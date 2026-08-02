import MiniSearch from 'minisearch';
import { openDB, type IDBPDatabase } from 'idb';
import { migrationRunner } from '../storage/MigrationRunner';
import { parseWikilinks } from './LinkParser';
import type { Note } from './NoteSchema';
import type { NoteIndexDoc, NoteSearchResult } from './types';

const INDEX_RECORD_ID = 'note-search';

/** Persisted record stored in the 'index' object store (RESEARCH §Pattern 3). */
interface PersistedIndexRecord {
  id: string;
  json: string;
  /** Full indexable docs — needed to rebuild <mark> snippets after load(). */
  docs: NoteIndexDoc[];
  updatedAt: number;
}

/**
 * Convert a Note to its searchable index document (D-12 indexed fields:
 * title, content, tags, wikilinkTargets).
 */
export function toIndexDoc(note: Note): NoteIndexDoc {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    tags: note.tags,
    wikilinkTargets: parseWikilinks(note.content),
    updatedAt: note.updatedAt,
  };
}

const INDEX_FIELDS = ['title', 'content', 'tags', 'wikilinkTargets'] as string[];
const INDEX_STORE_FIELDS = ['title', 'tags', 'updatedAt'] as string[];
const INDEX_SEARCH_OPTIONS = { boost: { title: 2.0 }, prefix: true };

const SNIPPET_MAX_LENGTH = 200;
const SNIPPET_CONTEXT_CHARS = 40;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape HTML entities so user-controlled content cannot execute as markup
 * (WR-07 stored-XSS defense at the snippet render boundary).
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Private-use placeholder tokens for the injected highlight tags — the
 * escape pass must not alter them (escapeHtml only touches & < >), and
 * content-originated markup can never masquerade as a highlight tag.
 */
const MARK_OPEN = '\uE010';
const MARK_CLOSE = '\uE011';

/**
 * Build a text excerpt around the first query-term match with <mark>-
 * wrapped highlights (must_haves: result.snippet contains <mark> highlights).
 * Note content is user-controlled (possibly imported): terms are wrapped
 * with placeholder tokens, the whole excerpt is HTML-escaped, and only then
 * are the tokens restored to <mark> tags — so <mark> is the ONLY markup the
 * snippet can ever contain (WR-07).
 */
function buildSnippet(doc: NoteIndexDoc, query: string): string {
  const text = `${doc.title} ${doc.content}`;
  const terms = (query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).slice(0, 5);
  const lowerText = text.toLowerCase();

  let firstIdx = -1;
  for (const term of terms) {
    const idx = lowerText.indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  let excerpt: string;
  if (firstIdx === -1) {
    excerpt = doc.content.slice(0, SNIPPET_MAX_LENGTH);
  } else {
    const start = Math.max(0, firstIdx - SNIPPET_CONTEXT_CHARS);
    excerpt = text.slice(start, start + SNIPPET_MAX_LENGTH);
  }

  for (const term of terms) {
    excerpt = excerpt.replace(
      new RegExp(`(${escapeRegExp(term)})`, 'gi'),
      `${MARK_OPEN}$1${MARK_CLOSE}`,
    );
  }
  excerpt = escapeHtml(excerpt);
  excerpt = excerpt
    .replace(new RegExp(MARK_OPEN, 'g'), '<mark>')
    .replace(new RegExp(MARK_CLOSE, 'g'), '</mark>');
  return excerpt;
}

/**
 * Persistent MiniSearch index over notes (D-12) — a separate instance from
 * the Phase 4a ephemeral page index. Serialized to IndexedDB via toJSON()/
 * loadJSON() with full docs persisted alongside so <mark> snippets survive
 * a persist()/load() round-trip.
 */
export class MiniSearchNoteIndex {
  private index: MiniSearch<NoteIndexDoc>;
  /** Full docs by id — source for snippets and fast removal (PageIndexBuilder pattern). */
  private readonly docs = new Map<string, NoteIndexDoc>();

  constructor() {
    this.index = new MiniSearch<NoteIndexDoc>({
      fields: INDEX_FIELDS,
      storeFields: INDEX_STORE_FIELDS,
      searchOptions: INDEX_SEARCH_OPTIONS,
    });
  }

  private async openDb(): Promise<IDBPDatabase> {
    await migrationRunner.migrate('NotesDB', 5);
    const db = await openDB('NotesDB', 5);
    return db;
  }

  /** Persist the serialized index (toJSON) plus full docs to IndexedDB. */
  async persist(): Promise<void> {
    const db = await this.openDb();
    try {
      const record: PersistedIndexRecord = {
        id: INDEX_RECORD_ID,
        json: JSON.stringify(this.index),
        docs: Array.from(this.docs.values()),
        updatedAt: Date.now(),
      };
      await db.put('index', record);
    } finally {
      db.close();
    }
  }

  /** Restore the index and docs registry from IndexedDB (no-op if absent). */
  async load(): Promise<void> {
    const db = await this.openDb();
    try {
      const stored = await db.get('index', INDEX_RECORD_ID);
      if (stored?.json) {
        this.index = MiniSearch.loadJSON<NoteIndexDoc>(stored.json, {
          fields: INDEX_FIELDS,
          storeFields: INDEX_STORE_FIELDS,
          searchOptions: INDEX_SEARCH_OPTIONS,
        });
        this.docs.clear();
        for (const doc of stored.docs ?? []) {
          this.docs.set(doc.id, doc);
        }
      }
    } finally {
      db.close();
    }
  }

  /**
   * Incremental update after a note save — upsert semantics. MiniSearch's
   * replace() throws for unknown IDs, so new docs are added instead.
   */
  replace(doc: NoteIndexDoc): void {
    if (this.index.has(doc.id)) {
      this.index.replace(doc);
    } else {
      this.index.add(doc);
    }
    this.docs.set(doc.id, doc);
  }

  /** Incremental removal after a note delete. */
  remove(noteId: string): void {
    if (this.index.has(noteId)) {
      this.index.discard(noteId);
    }
    this.docs.delete(noteId);
  }

  /**
   * BM25-ranked search with title boosting (2.0x) and prefix matching.
   * Results are enriched to the UI-SPEC NoteSearchResult contract with
   * matched fields and a <mark>-highlighted snippet.
   */
  search(query: string, limit = 20): NoteSearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const results = this.index.search(trimmed).slice(0, limit);

    return results.map((result) => {
      const doc = this.docs.get(result.id as string);
      // result.match maps matched TERMS to the fields they matched in —
      // collect the union of fields to derive matchedFields
      const matchedFields = new Set<string>();
      for (const fields of Object.values(result.match ?? {})) {
        for (const field of fields) {
          matchedFields.add(field);
        }
      }
      return {
        noteId: result.id as string,
        score: result.score,
        matchedFields: Array.from(matchedFields) as NoteSearchResult['matchedFields'],
        snippet: doc ? buildSnippet(doc, trimmed) : '',
      };
    });
  }

  /** Full rebuild from a note set — startup recovery, import, migrations. */
  async rebuild(notes: Note[]): Promise<void> {
    this.index.removeAll();
    this.docs.clear();
    const docs = notes.map(toIndexDoc);
    if (docs.length > 0) {
      this.index.addAll(docs);
      for (const doc of docs) {
        this.docs.set(doc.id, doc);
      }
    }
  }
}

/** Module-level singleton for extension-page consumers (PageIndexBuilder pattern). */
export const noteSearchIndex = new MiniSearchNoteIndex();
