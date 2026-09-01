// NoteGraphProvenance.test.ts — KNW-01 knowledge-edge provenance (D-130).
//
// Proves edge provenance operations: tagging, accepting, filtering by source,
// and merging. Also covers computeBacklinksWithProvenance and the NotesDB
// populateLinkProvenanceDefaults migration.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  tagEdgeSource,
  acceptSuggestedLink,
  getEdgesBySource,
  mergeEdgeProvenance,
} from '@/core/notes/NoteGraphProvenance';
import { computeBacklinks, computeBacklinksWithProvenance } from '@/core/notes/NoteGraph';
import type { Note } from '@/types/notes';
import { openNotesDB } from '@/core/storage/NotesDB';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Test Note',
    content: 'default content',
    created: 1000,
    updated: 1000,
    tags: [],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

describe('NoteGraphProvenance — KNW-01 edge provenance operations', () => {
  describe('tagEdgeSource', () => {
    it('tags all links with the given source', () => {
      const links = [
        { noteId: 'a', source: 'explicit' as const },
        { noteId: 'b', source: 'suggested' as const },
      ];
      const result = tagEdgeSource(links, 'imported');
      expect(result).toEqual([
        { noteId: 'a', source: 'imported' },
        { noteId: 'b', source: 'imported' },
      ]);
    });

    it('returns empty array for empty links', () => {
      expect(tagEdgeSource([], 'explicit')).toEqual([]);
    });
  });

  describe('acceptSuggestedLink', () => {
    it('changes suggested → accepted for matching noteId', () => {
      const links = [
        { noteId: 'a', source: 'suggested' as const },
        { noteId: 'b', source: 'explicit' as const },
      ];
      const result = acceptSuggestedLink(links, 'a');
      expect(result).toEqual([
        { noteId: 'a', source: 'accepted' },
        { noteId: 'b', source: 'explicit' },
      ]);
    });

    it('does not change non-suggested links', () => {
      const links = [{ noteId: 'a', source: 'explicit' as const }];
      const result = acceptSuggestedLink(links, 'a');
      expect(result).toEqual([{ noteId: 'a', source: 'explicit' }]);
    });

    it('does nothing for non-matching noteId', () => {
      const links = [{ noteId: 'a', source: 'suggested' as const }];
      const result = acceptSuggestedLink(links, 'x');
      expect(result).toEqual([{ noteId: 'a', source: 'suggested' }]);
    });
  });

  describe('getEdgesBySource', () => {
    it('filters edges by provenance source', () => {
      const notes = [
        makeNote({ id: 'A', links: [{ noteId: 'B', source: 'explicit' }, { noteId: 'C', source: 'suggested' }] }),
        makeNote({ id: 'B', links: [{ noteId: 'C', source: 'explicit' }] }),
      ];
      const result = getEdgesBySource(notes, 'explicit');
      expect(result).toEqual([
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ]);
    });

    it('returns empty array when no edges match', () => {
      const notes = [makeNote({ id: 'A', links: [{ noteId: 'B', source: 'suggested' }] })];
      expect(getEdgesBySource(notes, 'explicit')).toEqual([]);
    });
  });

  describe('mergeEdgeProvenance', () => {
    it('appends incoming links not in existing', () => {
      const existing = [{ noteId: 'a', source: 'explicit' as const }];
      const incoming = [{ noteId: 'b', source: 'suggested' as const }];
      expect(mergeEdgeProvenance(existing, incoming)).toEqual([
        { noteId: 'a', source: 'explicit' },
        { noteId: 'b', source: 'suggested' },
      ]);
    });

    it('existing preferred unless incoming is explicit', () => {
      const existing = [{ noteId: 'a', source: 'suggested' as const }];
      const incoming = [{ noteId: 'a', source: 'imported' as const }];
      // existing 'suggested' is preferred over incoming 'imported'
      expect(mergeEdgeProvenance(existing, incoming)).toEqual([{ noteId: 'a', source: 'suggested' }]);
    });

    it('explicit incoming overwrites existing', () => {
      const existing = [{ noteId: 'a', source: 'suggested' as const }];
      const incoming = [{ noteId: 'a', source: 'explicit' as const }];
      expect(mergeEdgeProvenance(existing, incoming)).toEqual([{ noteId: 'a', source: 'explicit' }]);
    });
  });

  describe('computeBacklinksWithProvenance', () => {
    it('preserves source metadata in reverse index', () => {
      const notes = [
        makeNote({ id: 'A', links: [{ noteId: 'B', source: 'explicit' }] }),
        makeNote({ id: 'B', links: [] }),
        makeNote({ id: 'C', links: [{ noteId: 'B', source: 'suggested' }] }),
      ];
      const backlinks = computeBacklinksWithProvenance(notes);
      expect(backlinks.get('B')).toEqual([
        { noteId: 'A', source: 'explicit' },
        { noteId: 'C', source: 'suggested' },
      ]);
    });

    it('excludes non-live targets', () => {
      const notes = [makeNote({ id: 'A', links: [{ noteId: 'GONE', source: 'explicit' }] })];
      const backlinks = computeBacklinksWithProvenance(notes);
      expect(backlinks.get('GONE')).toBeUndefined();
    });
  });

  describe('computeBacklinks (backward compatibility)', () => {
    it('produces same results as before for {noteId, source} fixtures', () => {
      const a = makeNote({ id: 'A', links: [{ noteId: 'B', source: 'explicit' }] });
      const b = makeNote({ id: 'B', links: [] });
      const c = makeNote({ id: 'C', links: [{ noteId: 'B', source: 'suggested' }] });
      const backlinks = computeBacklinks([a, b, c]);
      expect(backlinks.get('B')).toEqual(['A', 'C']);
    });
  });
});

describe('populateLinkProvenanceDefaults — KNW-01 data migration', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
  });

  it('migrates string[] links to {noteId, source: explicit}[]', async () => {
    // Create a note with old-shape links (strings) by directly writing to IDB.
    const db = await openNotesDB();
    const oldNote = makeNote({ id: 'old-1', links: [] });
    // Bypass the type system to simulate old data shape.
    (oldNote as any).links = ['target-1', 'target-2'];
    await db.put('notes', oldNote);
    db.close();

    // Re-open triggers populateLinkProvenanceDefaults.
    const db2 = await openNotesDB();
    const fetched = await db2.get('notes', 'old-1');
    expect(fetched).toBeDefined();
    expect(fetched!.links).toEqual([
      { noteId: 'target-1', source: 'explicit' },
      { noteId: 'target-2', source: 'explicit' },
    ]);
    db2.close();
  });

  it('does not overwrite already-migrated links', async () => {
    const db = await openNotesDB();
    const newNote = makeNote({
      id: 'new-1',
      links: [{ noteId: 'x', source: 'suggested' }],
    });
    await db.put('notes', newNote);
    db.close();

    // Re-open — should NOT change the source.
    const db2 = await openNotesDB();
    const fetched = await db2.get('notes', 'new-1');
    expect(fetched).toBeDefined();
    expect(fetched!.links).toEqual([{ noteId: 'x', source: 'suggested' }]);
    db2.close();
  });
});
