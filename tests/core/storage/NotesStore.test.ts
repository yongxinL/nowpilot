import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotesStore } from '../../../src/core/storage/NotesStore';
import { notesDb } from '../../../src/core/notes/NotesDB';
import { t } from '../../../src/core/i18n/strings';
import type { Note } from '../../../src/core/notes/NoteSchema';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    title: 'Test Note',
    content: 'content',
    tags: [],
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

describe('NotesStore', () => {
  beforeEach(() => {
    useNotesStore.setState({ ready: false, notes: [] });
    vi.restoreAllMocks();
  });

  it('loadNotes populates notes[] from NotesDB.getAll and sets ready=true', async () => {
    const notes = [makeNote(), makeNote()];
    vi.spyOn(notesDb, 'getAll').mockResolvedValue(notes);

    await useNotesStore.getState().loadNotes();

    const state = useNotesStore.getState();
    expect(notesDb.getAll).toHaveBeenCalledOnce();
    expect(state.ready).toBe(true);
    expect(state.notes).toEqual(notes);
  });

  it('loadNotes on error sets ready=true with empty notes[] — does not throw', async () => {
    vi.spyOn(notesDb, 'getAll').mockRejectedValue(new Error('quota exceeded'));

    await expect(useNotesStore.getState().loadNotes()).resolves.toBeUndefined();

    const state = useNotesStore.getState();
    expect(state.ready).toBe(true);
    expect(state.notes).toEqual([]);
  });

  it('saveNote delegates to NotesDB.save and appends to local notes[] on success', async () => {
    const note = makeNote();
    vi.spyOn(notesDb, 'save').mockResolvedValue({ success: true, noteId: note.id });

    const result = await useNotesStore.getState().saveNote(note);

    expect(result).toEqual({ success: true, noteId: note.id });
    expect(notesDb.save).toHaveBeenCalledWith(note);
    expect(useNotesStore.getState().notes).toContainEqual(note);
  });

  it('saveNote does not append when NotesDB.save fails', async () => {
    const note = makeNote();
    vi.spyOn(notesDb, 'save').mockResolvedValue({
      success: false,
      error: 'validation failed',
      code: 'VALIDATION_ERROR',
    });

    const result = await useNotesStore.getState().saveNote(note);

    expect(result.success).toBe(false);
    expect(useNotesStore.getState().notes).toEqual([]);
  });

  it('deleteNote calls NotesDB.remove, removes from local notes[] on success, returns true', async () => {
    const note = makeNote();
    useNotesStore.setState({ notes: [note] });
    vi.spyOn(notesDb, 'remove').mockResolvedValue({ success: true });

    const ok = await useNotesStore.getState().deleteNote(note.id);

    expect(ok).toBe(true);
    expect(notesDb.remove).toHaveBeenCalledWith(note.id);
    expect(useNotesStore.getState().notes).toEqual([]);
  });

  it('deleteNote returns false and keeps the note when NotesDB.remove fails', async () => {
    const note = makeNote();
    useNotesStore.setState({ notes: [note] });
    vi.spyOn(notesDb, 'remove').mockResolvedValue({ success: false, error: 'boom' });

    const ok = await useNotesStore.getState().deleteNote(note.id);

    expect(ok).toBe(false);
    expect(useNotesStore.getState().notes).toEqual([note]);
  });

  it('refreshNotes reloads from NotesDB', async () => {
    const notes = [makeNote({ title: 'Fresh' })];
    vi.spyOn(notesDb, 'getAll').mockResolvedValue(notes);
    useNotesStore.setState({ notes: [makeNote({ title: 'Stale' })] });

    await useNotesStore.getState().refreshNotes();

    expect(useNotesStore.getState().notes).toEqual(notes);
  });
});

describe('notes i18n strings', () => {
  const NOTES_KEYS = [
    'notes.empty',
    'notes.loading',
    'notes.error',
    'notes.saved',
    'notes.deleteConfirm',
    'notes.deleteAction',
    'notes.searchEmpty',
    'notes.createNew',
    'notes.save',
    'notes.search',
  ];
  const WIKILINK_KEYS = [
    'wikilink.unresolved',
    'wikilink.create',
    'wikilink.created',
    'wikilink.createAction',
    'linkparser.error',
    'notegraph.error',
  ];
  const MEMORY_KEYS = [
    'memory.retrievalError',
    'memory.writeConflict',
    'memory.summaryError',
  ];
  const ALL_KEYS = [...NOTES_KEYS, ...WIKILINK_KEYS, ...MEMORY_KEYS];

  it('t(notes.empty) resolves to a non-empty string', () => {
    expect(t('notes.empty')).toBeTruthy();
  });

  it('all notes/wikilink/memory keys resolve to non-empty strings', () => {
    expect(ALL_KEYS).toHaveLength(19);
    for (const key of ALL_KEYS) {
      expect(t(key).length).toBeGreaterThan(0);
    }
  });

  it('t() for an unknown key returns the key itself (existing pattern)', () => {
    expect(t('unknown.key.xyz')).toBe('unknown.key.xyz');
  });
});
