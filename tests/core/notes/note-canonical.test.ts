import { describe, it, expect, beforeEach } from 'vitest';
import { openNotesDB, NOTES_DB, NOTES_DB_VERSION } from '../../../src/core/storage/NotesDB';
import { OKF_NOTE_DEFAULT_TYPE, NOTE_SUGGESTION_DISPLAY_THRESHOLD } from '../../../src/types/notes';

/**
 * TRACER proof — canonical Note round-trips through NotesDB put/get with
 * links/unresolvedLinks/aiMeta/source fields intact (the type spine
 * end-to-end: declare -> re-export -> storage).
 */

describe('Note canonical — NotesDB put/get round-trip (D-107/D-108)', () => {
  beforeEach(() => {
    (globalThis as any).__resetIndexedDB();
  });

  it('round-trips canonical fields (links/unresolvedLinks/aiMeta/source)', async () => {
    const db = await openNotesDB();

    const note = {
      id: 'note-tracer-001',
      title: 'Tracer Note',
      content: 'This references [[Wikilink Target]] and [[No Such Note]].',
      created: 1700000000000,
      updated: 1700000000001,
      tags: ['tracer', 'wikilink'],
      links: ['note-1'],
      unresolvedLinks: ['[[No Such Note]]'],
      source: { kind: 'manual' as const },
      aiMeta: {
        suggestedLinks: [{ targetId: 'note-2', confidence: 0.85, reason: 'semantic match' }],
        concepts: ['tracer', 'wikilink'],
      },
      version: 1,
    };

    await db.put('notes', note);
    const fetched = await db.get('notes', 'note-tracer-001');

    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe('note-tracer-001');
    expect(fetched!.title).toBe('Tracer Note');
    expect(fetched!.links).toEqual(['note-1']);
    expect(fetched!.unresolvedLinks).toEqual(['[[No Such Note]]']);
    expect(fetched!.source).toEqual({ kind: 'manual' });
    expect(fetched!.aiMeta.suggestedLinks).toEqual([
      { targetId: 'note-2', confidence: 0.85, reason: 'semantic match' },
    ]);
    expect(fetched!.aiMeta.concepts).toEqual(['tracer', 'wikilink']);
    expect(fetched!.tags).toEqual(['tracer', 'wikilink']);
    expect(fetched!.version).toBe(1);

    db.close();
  });

  it('exports OKF_NOTE_DEFAULT_TYPE === "Note"', () => {
    expect(OKF_NOTE_DEFAULT_TYPE).toBe('Note');
  });

  it('exports NOTE_SUGGESTION_DISPLAY_THRESHOLD === 0.60', () => {
    expect(NOTE_SUGGESTION_DISPLAY_THRESHOLD).toBe(0.60);
  });
});
