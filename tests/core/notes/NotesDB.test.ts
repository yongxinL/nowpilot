import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notesDb, resetNotesDb } from '../../../src/core/notes/NotesDB';
import { MiniSearchNoteIndex } from '../../../src/core/notes/MiniSearchNoteIndex';
import { resetJournalDb, getEntriesByStatus } from '../../../src/core/storage/WriteJournal';
import { on } from '../../../src/core/events/EventBus';
import type { Note } from '../../../src/core/notes/NoteSchema';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    title: 'Test Note',
    content: 'Plain content without links',
    tags: ['work'],
    categoryPath: '',
    createdAt: 1000,
    updatedAt: 1000,
    version: 1,
    provenance: { source: 'user-created' },
    links: [],
    unresolvedLinks: [],
    ...overrides,
  };
}

describe('NotesDB', () => {
  beforeEach(async () => {
    await resetNotesDb();
    await resetJournalDb();
  });

  it('validates via NoteSchema — invalid notes return VALIDATION_ERROR', async () => {
    const result = await notesDb.save({
      id: 'not-a-uuid',
      title: '',
      content: 'x',
    } as unknown as Note);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('persists a note and retrieves it with wikilinks resolved to IDs', async () => {
    const target = makeNote({ id: crypto.randomUUID(), title: 'Target Note' });
    await notesDb.save(target);

    const source = makeNote({
      title: 'Source Note',
      content: 'See [[Target Note]] for details',
    });
    const result = await notesDb.save(source);
    expect(result).toEqual({ success: true, noteId: source.id });

    const found = await notesDb.get(source.id);
    expect(found.success).toBe(true);
    if (found.success) {
      expect(found.note.links).toEqual([target.id]);
      expect(found.note.unresolvedLinks).toEqual([]);
      expect(found.note.title).toBe('Source Note');
    }
  });

  it('tracks unresolved wikilinks when the target note does not exist', async () => {
    const source = makeNote({ title: 'Source Note', content: 'See [[Missing Note]]' });
    await notesDb.save(source);

    const found = await notesDb.get(source.id);
    expect(found.success).toBe(true);
    if (found.success) {
      expect(found.note.links).toEqual([]);
      expect(found.note.unresolvedLinks).toEqual(['Missing Note']);
    }
  });

  it('emits note:saved after a successful WriteJournal commit', async () => {
    const listener = vi.fn();
    const unsubscribe = on('note:saved', listener);
    try {
      const note = makeNote();
      await notesDb.save(note);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ noteId: note.id });
    } finally {
      unsubscribe();
    }
  });

  it('findByTitle returns notes matching the by-title index', async () => {
    const note = makeNote({ title: 'Unique Title' });
    await notesDb.save(note);

    const matches = await notesDb.findByTitle('Unique Title');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(note.id);
  });

  it('getAll returns [] when no notes exist', async () => {
    expect(await notesDb.getAll()).toEqual([]);
  });

  it('get returns NOT_FOUND for a missing note', async () => {
    const result = await notesDb.get('00000000-0000-4000-8000-000000000000');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('NOT_FOUND');
    }
  });

  it('remove deletes a persisted note', async () => {
    const note = makeNote();
    await notesDb.save(note);

    const result = await notesDb.remove(note.id);
    expect(result.success).toBe(true);
    expect((await notesDb.get(note.id)).success).toBe(false);
  });

  it('increments the version counter on update — no duplicate rows', async () => {
    const note = makeNote({ content: 'first version' });
    await notesDb.save(note);
    await notesDb.save(note);

    const all = await notesDb.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].version).toBe(2);
    expect(all[0].content).toBe('first version');
  });

  it('wraps saves in a WriteJournal entry with save-note-with-links operation', async () => {
    await notesDb.save(makeNote());

    const entries = await getEntriesByStatus('completed');
    const entry = entries.find((e) => e.operation === 'save-note-with-links');
    expect(entry).toBeDefined();
    expect(entry!.steps.map((s) => s.name)).toEqual(['write-note', 'update-index']);
    expect(entry!.steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('persists the search index after save — a fresh index instance restores it (WR-01)', async () => {
    const note = makeNote({
      id: crypto.randomUUID(),
      title: 'Persistent Index',
      content: 'persisted searchable content',
    });
    await notesDb.save(note);

    // a fresh index instance (new JS session) restores the persisted index
    const fresh = new MiniSearchNoteIndex();
    await fresh.load();
    const results = fresh.search('persisted');
    expect(results.some((r) => r.noteId === note.id)).toBe(true);
  });

  it('persists index removal — a fresh index instance no longer finds a deleted note (WR-01)', async () => {
    const note = makeNote({
      id: crypto.randomUUID(),
      title: 'To Be Removed',
      content: 'delete me from the index',
    });
    await notesDb.save(note);
    await notesDb.remove(note.id);

    const fresh = new MiniSearchNoteIndex();
    await fresh.load();
    expect(fresh.search('delete').some((r) => r.noteId === note.id)).toBe(false);
  });
});
