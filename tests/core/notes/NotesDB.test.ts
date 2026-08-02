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
      expect(listener).toHaveBeenCalledWith({ noteId: note.id, version: 1 });
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

  it('updateSyncState persists lastSyncedAt + lastSyncedFileName; save() preserves both when omitted (WR-04)', async () => {
    const note = makeNote();
    await notesDb.save(note);

    await notesDb.updateSyncState(note.id, { lastSyncedAt: 1111, lastSyncedFileName: 'React 1.md' });
    const after = await notesDb.get(note.id);
    expect(after.success).toBe(true);
    if (after.success) {
      expect(after.note.lastSyncedAt).toBe(1111);
      expect(after.note.lastSyncedFileName).toBe('React 1.md');
    }

    // A later save() whose payload omits both fields preserves them — the
    // next sync must not see a stripped lastSyncedFileName (WR-04).
    await notesDb.save({ ...note, content: 'new content' });
    const persisted = await notesDb.get(note.id);
    expect(persisted.success).toBe(true);
    if (persisted.success) {
      expect(persisted.note.lastSyncedAt).toBe(1111);
      expect(persisted.note.lastSyncedFileName).toBe('React 1.md');
    }
  });

  it('updateSyncState reads and writes within ONE transaction — no clobber window for a concurrent save() (WR-04)', async () => {
    const note = makeNote({ content: 'v1' });
    await notesDb.save(note);

    // The fix must collapse the old get-then-put (two transactions, with a
    // save() landing in between) into a single atomic readwrite transaction.
    // idb's wrapper delegates to the native (fake-indexeddb) database, so
    // spy on the native prototype.
    const nativeDb = (globalThis as unknown as {
      IDBDatabase: { prototype: { transaction: (...args: unknown[]) => unknown } };
    }).IDBDatabase;
    const txSpy = vi.spyOn(nativeDb.prototype, 'transaction');
    try {
      await notesDb.updateSyncState(note.id, { lastSyncedAt: 1234, lastSyncedFileName: 'Owned.md' });
      // Assert BEFORE mockRestore — restore clears the call history.
      expect(txSpy).toHaveBeenCalledTimes(1);
    } finally {
      txSpy.mockRestore();
    }

    const after = await notesDb.get(note.id);
    expect(after.success).toBe(true);
    if (after.success) {
      expect(after.note.lastSyncedAt).toBe(1234);
      expect(after.note.lastSyncedFileName).toBe('Owned.md');
    }
  });

  it('a concurrent save() + updateSyncState() never leaves stale content from the state write (WR-04)', async () => {
    const note = makeNote({ content: 'v1' });
    await notesDb.save(note);

    // Fire both concurrently. The state write is a single atomic
    // transaction, so it can never read the old note, get overtaken by the
    // save, and then resurrect the stale snapshot — the save's newer
    // content always wins regardless of the interleaving order.
    await Promise.all([
      notesDb.save({ ...note, content: 'v2 concurrent edit' }),
      notesDb.updateSyncState(note.id, { lastSyncedAt: 4321, lastSyncedFileName: 'Concurrent.md' }),
    ]);

    const after = await notesDb.get(note.id);
    expect(after.success).toBe(true);
    if (after.success) {
      expect(after.note.content).toBe('v2 concurrent edit');
    }
  });

  describe('staleness timestamp diff-writer (WR-03)', () => {
    it('save with changed tags stamps tagsGeneratedAt; unchanged tags preserve it', async () => {
      const note = makeNote({ tags: ['work'] });
      await notesDb.save(note); // create → never-enriched, no stamp
      const seeded = await notesDb.get(note.id);
      const t0 = seeded.success ? seeded.note.tagsGeneratedAt : undefined;
      expect(t0).toBeUndefined();

      // tags changed vs persisted → stamped
      await notesDb.save({ ...note, tags: ['work', 'ai'] });
      const second = await notesDb.get(note.id);
      const t1 = second.success ? second.note.tagsGeneratedAt : undefined;
      expect(typeof t1).toBe('number');
      expect(t1!).toBeGreaterThanOrEqual(t0 ?? 0);

      // same tags on a content edit → preserved, not re-stamped
      await notesDb.save({ ...note, tags: ['work', 'ai'], content: 'edited' });
      const third = await notesDb.get(note.id);
      expect(third.success).toBe(true);
      if (third.success) {
        expect(third.note.tagsGeneratedAt).toBe(t1);
      }
    });

    it('save with changed summary stamps summaryGeneratedAt; unchanged summary preserves it', async () => {
      const note = makeNote({ summary: 'S1' });
      await notesDb.save(note); // create → never-enriched, no stamp
      const seeded = await notesDb.get(note.id);
      const t0 = seeded.success ? seeded.note.summaryGeneratedAt : undefined;
      expect(t0).toBeUndefined();

      // summary changed vs persisted → stamped
      await notesDb.save({ ...note, summary: 'S2' });
      const second = await notesDb.get(note.id);
      const t1 = second.success ? second.note.summaryGeneratedAt : undefined;
      expect(typeof t1).toBe('number');
      expect(t1!).toBeGreaterThanOrEqual(t0 ?? 0);

      // same summary on a content edit → preserved
      await notesDb.save({ ...note, summary: 'S2', content: 'edited' });
      const third = await notesDb.get(note.id);
      expect(third.success).toBe(true);
      if (third.success) {
        expect(third.note.summaryGeneratedAt).toBe(t1);
      }

      // summary removed (undefined) is a change → re-stamped
      await notesDb.save({ ...note, summary: undefined });
      const fourth = await notesDb.get(note.id);
      expect(fourth.success).toBe(true);
      if (fourth.success) {
        expect(typeof fourth.note.summaryGeneratedAt).toBe('number');
        expect(fourth.note.summaryGeneratedAt!).toBeGreaterThanOrEqual(t1!);
      }
    });

    it('create leaves both timestamps unset unless the payload explicitly carries them (never-enriched preserved)', async () => {
      const note = makeNote();
      await notesDb.save(note);
      const after = await notesDb.get(note.id);
      expect(after.success).toBe(true);
      if (after.success) {
        expect(after.note.tagsGeneratedAt).toBeUndefined();
        expect(after.note.summaryGeneratedAt).toBeUndefined();
      }

      const explicit = makeNote({ tagsGeneratedAt: 111, summaryGeneratedAt: 222 });
      await notesDb.save(explicit);
      const explicitAfter = await notesDb.get(explicit.id);
      expect(explicitAfter.success).toBe(true);
      if (explicitAfter.success) {
        expect(explicitAfter.note.tagsGeneratedAt).toBe(111);
        expect(explicitAfter.note.summaryGeneratedAt).toBe(222);
      }
    });
  });
});

