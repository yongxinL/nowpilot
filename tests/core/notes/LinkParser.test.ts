// LinkParser tests — §18 required (08-03, Task 1).
//
// Proves D-110: parseLinks extracts [[Title]] targets (deduped, trimmed);
// resolveLinks applies the WIKI-ID-02 tie-break (exact title → updated desc →
// id asc) via getAllFromIndex + explicit sort — NEVER getNoteByTitle
// (Pitfall 4); unresolved targets land in unresolvedLinks[] (WIKI-ID-03);
// demoteDangling handles WIKI-ID-04 without rewriting bodies; saveNote runs
// the full Flow-3-minus-LLM path (parse → resolve → NotesDB.put → emit
// note:saved).
import { describe, it, expect, beforeEach } from 'vitest';

import type { IDBPDatabase } from 'idb';
import { openNotesDB, type NotesDBV1 } from '@/core/storage/NotesDB';
import type { Note } from '@/core/storage/NotesDB';
import { on } from '@/core/events/EventBus';
import {
  WIKILINK_RE,
  parseLinks,
  resolveLinks,
  demoteDangling,
} from '@/core/notes/LinkParser';
import {
  NOTE_SAVED_EVENT,
  saveNote,
  type NoteSavedPayload,
} from '@/core/notes/save';

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: over.id ?? 'note-1',
    title: over.title ?? 'Note',
    content: over.content ?? '',
    created: over.created ?? 1000,
    updated: over.updated ?? 1000,
    tags: over.tags ?? [],
    links: over.links ?? [],
    unresolvedLinks: over.unresolvedLinks ?? [],
    source: over.source ?? { kind: 'manual' },
    aiMeta: over.aiMeta ?? { suggestedLinks: [], concepts: [] },
    version: over.version ?? 1,
    ...over,
  };
}

describe('LinkParser', () => {
  describe('parseLinks', () => {
    it('(1) extracts [[Title]] targets in document order, deduplicated', () => {
      expect(parseLinks('See [[Alpha]] and [[Beta]] and [[Alpha]] again')).toEqual([
        'Alpha',
        'Beta',
      ]);
    });

    it('(2) returns [] when no wikilinks present', () => {
      expect(parseLinks('Plain text with no links')).toEqual([]);
    });

    it('(3) trims whitespace-only targets', () => {
      expect(parseLinks('Link: [[  Trimmed  ]]')).toEqual(['Trimmed']);
    });

    it('(4) WIKILINK_RE is the [[Title]] regex', () => {
      expect(WIKILINK_RE.source).toBe(/\[\[([^\]]+)\]\]/g.source);
    });
  });

  describe('resolveLinks — WIKI-ID-02 tie-break (Pitfall 4)', () => {
    let db: IDBPDatabase<NotesDBV1>;
    beforeEach(async () => {
      (globalThis as any).__resetIndexedDB();
      db = await openNotesDB();
    });

    it('(1) resolves the NEWER note when two share a title (updated desc)', async () => {
      const older = makeNote({ id: 'old', title: 'Same', updated: 100 });
      const newer = makeNote({ id: 'new', title: 'Same', updated: 200 });
      await db.put('notes', older);
      await db.put('notes', newer);
      const { links, unresolvedLinks } = await resolveLinks(db, ['Same']);
      expect(links).toEqual(['new']);
      expect(unresolvedLinks).toEqual([]);
    });

    it('(2) breaks an updated tie by id ASC', async () => {
      const a = makeNote({ id: 'b-id', title: 'Same', updated: 100 });
      const b = makeNote({ id: 'a-id', title: 'Same', updated: 100 });
      await db.put('notes', a);
      await db.put('notes', b);
      const { links } = await resolveLinks(db, ['Same']);
      expect(links).toEqual(['a-id']);
    });

    it('(3) exact-title only — does not match case/space variants', async () => {
      await db.put('notes', makeNote({ id: 'n1', title: 'Same' }));
      const { links, unresolvedLinks } = await resolveLinks(db, ['SAME']);
      expect(links).toEqual([]);
      expect(unresolvedLinks).toEqual(['SAME']);
    });

    it('(4) unresolved target lands in unresolvedLinks (WIKI-ID-03)', async () => {
      const { links, unresolvedLinks } = await resolveLinks(db, ['No Such Note']);
      expect(links).toEqual([]);
      expect(unresolvedLinks).toEqual(['No Such Note']);
    });

    it('(5) never imports/calls getNoteByTitle (Pitfall 4)', async () => {
      // Pitfall 4: getNoteByTitle returns an arbitrary first hit — resolveLinks
      // must use getAllFromIndex + sort. Assert no import or call site exists
      // (comments mentioning the prohibition are fine).
      const src = require('node:fs').readFileSync(
        require('node:path').resolve(process.cwd(), 'src/core/notes/LinkParser.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/import.*getNoteByTitle/);
      expect(src).not.toMatch(/getNoteByTitle\(/);
    });
  });

  describe('demoteDangling — WIKI-ID-04 (no body rewrite)', () => {
    it('(1) moves a dangling ID back to unresolvedLinks without db writes', () => {
      const liveIds = new Set<string>(['kept-id']);
      const idToTitle = new Map<string, string>([
        ['kept-id', 'Kept'],
        ['deleted-id', 'Deleted Title'],
      ]);
      const { links, unresolvedLinks } = demoteDangling(
        ['kept-id', 'deleted-id'],
        liveIds,
        [],
        idToTitle,
      );
      expect(links).toEqual(['kept-id']);
      expect(unresolvedLinks).toEqual(['Deleted Title']);
    });

    it('(2) preserves pre-existing unresolvedLinks', () => {
      const liveIds = new Set<string>([]);
      const idToTitle = new Map<string, string>([['gone', 'Gone']]);
      const { links, unresolvedLinks } = demoteDangling(
        ['gone'],
        liveIds,
        ['Already Unresolved'],
        idToTitle,
      );
      expect(links).toEqual([]);
      expect(unresolvedLinks).toEqual(['Already Unresolved', 'Gone']);
    });
  });

  describe('saveNote — Flow-3-minus-LLM end-to-end', () => {
    let db: IDBPDatabase<NotesDBV1>;
    beforeEach(async () => {
      (globalThis as any).__resetIndexedDB();
      db = await openNotesDB();
    });

    it('(1) resolves [[Alpha]] → links=[alphaId], emits note:saved', async () => {
      await db.put('notes', makeNote({ id: 'alpha', title: 'Alpha' }));
      const note = makeNote({ id: 'n1', content: 'See [[Alpha]]' });
      let received = false;
      const unsub = on<NoteSavedPayload>(NOTE_SAVED_EVENT, (p) => {
        if (p.noteId === 'n1') received = true;
      });
      const { note: saved } = await saveNote(db, note);
      unsub();
      expect(saved.links).toEqual(['alpha']);
      expect(saved.unresolvedLinks).toEqual([]);
      expect(received).toBe(true);
    });

    it('(2) unmatched target → unresolvedLinks carries the raw target', async () => {
      const note = makeNote({ id: 'n2', content: 'Link to [[Ghost]]' });
      const { note: saved } = await saveNote(db, note);
      expect(saved.links).toEqual([]);
      expect(saved.unresolvedLinks).toEqual(['Ghost']);
    });

    it('(3) NOTE_SAVED_EVENT is the typed constant', () => {
      expect(NOTE_SAVED_EVENT).toBe('note:saved');
    });
  });
});
