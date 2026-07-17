import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note } from '../../../src/core/notes/LinkParser';

// ── Hoisted Mock Values ──
// vi.mock is hoisted to file top; mock values must be created via vi.hoisted()

const {
  mockWritable,
  mockFileHandle,
  mockDirHandle,
  mockDB,
  mockNotesDB,
  mockGetDB,
} = vi.hoisted(() => {
  const mw = { write: vi.fn(), close: vi.fn() };

  const mfh = {
    createWritable: vi.fn().mockResolvedValue(mw),
    getFile: vi.fn(),
    name: 'test.md',
    kind: 'file' as const,
  };

  const mdh: any = {
    name: 'test-backup',
    kind: 'directory' as const,
    getDirectoryHandle: vi.fn(),
    getFileHandle: vi.fn(),
    removeEntry: vi.fn(),
    queryPermission: vi.fn(),
    requestPermission: vi.fn(),
    values: vi.fn(),
    keys: vi.fn(),
  };

  const md = {
    get: vi.fn(),
    put: vi.fn(),
  };

  const mndb = {
    getAllNotes: vi.fn(),
    getNote: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  };

  const gdb = vi.fn().mockResolvedValue(md);

  return { mockWritable: mw, mockFileHandle: mfh, mockDirHandle: mdh, mockDB: md, mockNotesDB: mndb, mockGetDB: gdb };
});

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));

vi.mock('../../../src/core/storage/stores/NotesDB', () => ({
  notesDB: mockNotesDB,
}));

// Module imports (vitest hoists vi.mock above these)
import { NoteFileSync, formatNoteAsMarkdown, parseNoteFromMarkdown, noteFileSync } from '../../../src/core/notes/NoteFileSync';

// ── Helpers ──

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: `note-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Note',
    content: 'Test content',
    created: now,
    updated: now,
    tags: ['test'],
    ...overrides,
  };
}

function setupBackupHandle(): void {
  mockDB.get.mockResolvedValue({
    id: 'primary',
    folderHandle: mockDirHandle,
    folderName: 'test-backup',
    lastSyncTimestamp: 1000,
  });
  mockDirHandle.queryPermission.mockResolvedValue('granted');
}

/**
 * Wait for the 50ms debounce in sync() to fire.
 * Uses real timers (no vi.useFakeTimers) to avoid microtask/timer interaction issues.
 */
async function waitSync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 60));
}

// ── Tests ──

describe('NoteFileSync', () => {
  let service: NoteFileSync;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NoteFileSync();

    // Default mock behavior
    mockDirHandle.queryPermission.mockResolvedValue('granted');
    mockDirHandle.requestPermission.mockResolvedValue('granted');
    mockDirHandle.getDirectoryHandle.mockResolvedValue(mockDirHandle);
    mockDirHandle.getFileHandle.mockImplementation(
      (_name: string, options?: { create?: boolean }) => {
        if (options?.create) return Promise.resolve(mockFileHandle);
        return Promise.reject(new Error('Not found'));
      },
    );
    mockDirHandle.removeEntry.mockResolvedValue(undefined);
    mockDirHandle.values.mockReturnValue(
      (async function* () {})(),
    );

    mockFileHandle.getFile.mockResolvedValue({
      lastModified: Date.now(),
      text: vi.fn().mockResolvedValue(''),
    });
    mockFileHandle.createWritable.mockResolvedValue(mockWritable);

    mockDB.get.mockResolvedValue(null);
    mockDB.put.mockResolvedValue(undefined);

    mockNotesDB.getAllNotes.mockResolvedValue([]);
    mockNotesDB.getNote.mockResolvedValue(undefined);
    mockNotesDB.createNote.mockResolvedValue(undefined);
    mockNotesDB.updateNote.mockResolvedValue(undefined);

    (window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockDirHandle);
  });

  // ── Test 1: setBackupFolder ──

  it('setBackupFolder() calls showDirectoryPicker and persists handle to notes_backup_config', async () => {
    mockDirHandle.name = 'my-notes-backup';
    const result = await service.setBackupFolder();

    expect(window.showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(mockDB.put).toHaveBeenCalledWith('notes_backup_config', {
      id: 'primary',
      folderHandle: mockDirHandle,
      folderName: 'my-notes-backup',
    });
    expect(result).toEqual({ folderName: 'my-notes-backup' });
  });

  // ── Test 2: getBackupStatus ──

  it('getBackupStatus() returns off when no handle stored', async () => {
    mockDB.get.mockResolvedValue(null);
    const result = await service.getBackupStatus();
    expect(result).toEqual({ status: 'off' });
  });

  it('getBackupStatus() returns on when handle has granted permission', async () => {
    mockDB.get.mockResolvedValue({
      id: 'primary',
      folderHandle: mockDirHandle,
      folderName: 'test-backup',
    });
    mockDirHandle.queryPermission.mockResolvedValue('granted');
    const result = await service.getBackupStatus();
    expect(result).toEqual({ status: 'on', folderName: 'test-backup' });
  });

  it('getBackupStatus() returns error when permission is denied', async () => {
    mockDB.get.mockResolvedValue({
      id: 'primary',
      folderHandle: mockDirHandle,
      folderName: 'test-backup',
    });
    mockDirHandle.queryPermission.mockResolvedValue('denied');
    const result = await service.getBackupStatus();
    expect(result).toEqual({ status: 'error', error: 'Permission revoked' });
  });

  // ── Test 3: sync creates .md with YAML frontmatter ──

  it('sync(note, create) writes .md with YAML frontmatter at correct path', async () => {
    setupBackupHandle();

    const note = makeNote({
      title: 'My Note',
      content: 'Hello world',
      categoryPath: 'InfoTech/Database',
      tags: ['tech', 'db'],
    });

    const syncPromise = service.sync(note, 'create');
    await waitSync();
    const result = await syncPromise;

    expect(result.success).toBe(true);
    // Should create nested directory
    expect(mockDirHandle.getDirectoryHandle).toHaveBeenCalledWith('InfoTech', { create: true });
    expect(mockDirHandle.getDirectoryHandle).toHaveBeenCalledWith('Database', { create: true });
    // Should create writable
    expect(mockFileHandle.createWritable).toHaveBeenCalled();
    // Should write markdown with frontmatter
    expect(mockWritable.write).toHaveBeenCalled();
    const writtenContent = mockWritable.write.mock.calls[0][0] as string;
    expect(writtenContent).toContain('---\n');
    expect(writtenContent).toContain('id:');
    expect(writtenContent).toContain('created:');
    expect(writtenContent).toContain('updated:');
    expect(writtenContent).toContain('tags:');
    expect(writtenContent).toContain('categoryPath:');
    expect(writtenContent).toContain('---\n\n');
    expect(writtenContent).toContain('Hello world');
    expect(mockWritable.close).toHaveBeenCalled();
  });

  // ── Test 4: Title collision ──

  it('sync() resolves title collisions with numerical suffix', async () => {
    setupBackupHandle();

    const note = makeNote({ title: 'My Note' });

    // Mock: getFileHandle('My Note.md') without create → resolves (file exists → collision)
    // getFileHandle('My Note (1).md') without create → rejects (name available)
    // getFileHandle('My Note (1).md') with create → resolves (write the file)
    mockDirHandle.getFileHandle
      .mockResolvedValueOnce(mockFileHandle) // 'My Note.md' exists
      .mockRejectedValueOnce(new Error('Not found')) // 'My Note (1).md' doesn't exist
      .mockResolvedValueOnce(mockFileHandle); // create 'My Note (1).md' with create:true

    const syncPromise = service.sync(note, 'create');
    await waitSync();
    const result = await syncPromise;

    expect(result.success).toBe(true);
    expect(mockDirHandle.getFileHandle).toHaveBeenCalledWith('My Note.md');
  });

  // ── Test 5: sync update ──

  it('sync(note, update) overwrites existing .md with new content', async () => {
    setupBackupHandle();

    const noteUpdated = 1000000;
    const fileLastModified = noteUpdated + 1000; // within 2000ms tolerance → no conflict

    mockFileHandle.getFile.mockResolvedValue({
      lastModified: fileLastModified,
      text: vi.fn().mockResolvedValue(''),
    });

    // First: external change check (no create option) → file exists
    // Second: create writable (with create option) → create file
    mockDirHandle.getFileHandle
      .mockResolvedValueOnce(mockFileHandle) // external change check
      .mockResolvedValueOnce(mockFileHandle); // actual write with create:true

    const syncPromise = service.sync({ ...makeNote({ title: 'My Note', content: 'Updated content' }), updated: noteUpdated }, 'update');
    await waitSync();
    const result = await syncPromise;

    expect(result.success).toBe(true);
    expect(mockFileHandle.createWritable).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalled();
    const writtenContent = mockWritable.write.mock.calls[0][0] as string;
    expect(writtenContent).toContain('Updated content');
  });

  // ── Test 6: sync delete ──

  it('sync(note, delete) removes .md file and prunes empty category folders', async () => {
    setupBackupHandle();

    const note = makeNote({
      title: 'Delete Me',
      categoryPath: 'Test/Folder',
    });

    // Mock directory empty check: values() returns empty (no children)
    mockDirHandle.values.mockReturnValue(
      (async function* () {})(),
    );

    const syncPromise = service.sync(note, 'delete');
    await waitSync();
    const result = await syncPromise;

    expect(result.success).toBe(true);
    expect(mockDirHandle.removeEntry).toHaveBeenCalledWith('Delete Me.md');
  });

  // ── Test 7: External change detection ──

  it('sync() detects external change — returns { conflict: true }', async () => {
    setupBackupHandle();

    const noteUpdated = 1000000;
    const fileLastModified = noteUpdated + 5000; // 5s after → outside tolerance → conflict

    mockFileHandle.getFile.mockResolvedValue({
      lastModified: fileLastModified,
      text: vi.fn().mockResolvedValue(''),
    });

    // getFileHandle for external change check only (no create) → file exists
    mockDirHandle.getFileHandle
      .mockResolvedValueOnce(mockFileHandle);

    const note = makeNote({ updated: noteUpdated, title: 'My Note' });
    const syncPromise = service.sync(note, 'update');
    await waitSync();
    const result = await syncPromise;

    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
  });

  // ── Test 8: sync is no-op when no backup folder ──

  it('sync() returns { success: false } when no backup folder set', async () => {
    mockDB.get.mockResolvedValue(null); // no config stored

    const note = makeNote();
    const result = await service.sync(note, 'create');

    expect(result.success).toBe(false);
    expect(mockDirHandle.getFileHandle).not.toHaveBeenCalled();
  });

  // ── Test 9: formatNoteAsMarkdown ──

  it('formatNoteAsMarkdown() produces valid YAML frontmatter + markdown body', () => {
    const note = makeNote({
      id: 'test-id-1',
      title: 'Test Title',
      content: '# Heading\n\nBody content\n\n- list item',
      created: 1000,
      updated: 2000,
      tags: ['tag1', 'tag2'],
      categoryPath: 'Category/Sub',
      summary: 'A test summary',
    });

    const result = formatNoteAsMarkdown(note);

    expect(result.startsWith('---\n')).toBe(true);
    expect(result).toContain('id: test-id-1');
    expect(result).toContain('created: 1000');
    expect(result).toContain('updated: 2000');
    expect(result).toContain('tag1');
    expect(result).toContain('categoryPath: Category/Sub');
    expect(result).toContain('summary: A test summary');
    expect(result).toContain('\n---\n\n');
    expect(result).toContain('# Heading');
    expect(result).toContain('Body content');
  });

  // ── Test 10: importFromFolder ──

  it('importFromFolder() walks directory tree and returns preview with correct counts', async () => {
    const mdContent = '---\nid: "existing-1"\ncreated: 1000\nupdated: 2000\ntags:\n  - test\n---\n\n# Existing Note\n\nContent here';

    const importFileHandle = {
      createWritable: vi.fn(),
      getFile: vi.fn().mockResolvedValue({
        lastModified: 2000,
        text: vi.fn().mockResolvedValue(mdContent),
      }),
      name: 'test.md',
      kind: 'file' as const,
    };

    // values() yields one file entry
    mockDirHandle.values.mockReturnValue(
      (async function* () {
        yield { name: 'test.md', kind: 'file' as const };
      })(),
    );
    mockDirHandle.getFileHandle.mockResolvedValue(importFileHandle);

    // Existing notes in DB
    mockNotesDB.getAllNotes.mockResolvedValue([
      makeNote({ id: 'existing-1', title: 'Existing Note', updated: 1000 }),
      makeNote({ id: 'other-note', title: 'Other' }),
    ]);

    const result = await service.importFromFolder();

    expect(result).not.toBeNull();
    if (result) {
      expect(result.preview.total).toBe(1);
      expect(result.preview.new).toBe(0);
      expect(result.preview.updated).toBe(1);
      expect(result.preview.unchanged).toBe(0);
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].id).toBe('existing-1');
      expect(result.notes[0].title).toBe('Existing Note');
    }
  });

  // ── Test 11: executeImport ──

  it('executeImport() upserts parsed notes into IndexedDB and returns allNotes', async () => {
    const importedNotes: Array<Partial<Note>> = [
      {
        id: 'new-note-1',
        title: 'New Note',
        content: 'Brand new',
        created: 1000,
        updated: 2000,
        tags: [],
      },
      {
        id: 'existing-note-1',
        title: 'Updated Note',
        content: 'Updated content',
        created: 1000,
        updated: 3000,
        tags: ['tag'],
      },
    ];

    // Existing note found for update
    mockNotesDB.getNote.mockImplementation(async (id: string) => {
      if (id === 'existing-note-1') {
        return makeNote({
          id: 'existing-note-1',
          title: 'Old Title',
          content: 'Old content',
          created: 1000,
          updated: 2000,
        });
      }
      return undefined;
    });

    // After import, return all notes
    const allNotesAfterImport = [
      makeNote({ id: 'new-note-1', title: 'New Note' }),
      makeNote({ id: 'existing-note-1', title: 'Updated Note' }),
    ];
    mockNotesDB.getAllNotes.mockResolvedValue(allNotesAfterImport);

    const result = await service.executeImport(importedNotes);

    expect(result.count).toBe(2);
    expect(mockNotesDB.createNote).toHaveBeenCalledTimes(1); // new-note-1
    expect(mockNotesDB.updateNote).toHaveBeenCalledTimes(1); // existing-note-1
    expect(result.allNotes).toEqual(allNotesAfterImport);
  });

  // ── parseNoteFromMarkdown ──

  it('parseNoteFromMarkdown() parses valid markdown with YAML frontmatter', () => {
    const md = '---\nid: "test-id-1"\ncreated: 1000\nupdated: 2000\ntags:\n  - tag1\n  - tag2\ncategoryPath: "Cat/Sub"\nsummary: "A summary"\n---\n\n# My Title\n\nBody text here';

    const result = parseNoteFromMarkdown(md);
    expect(result.id).toBe('test-id-1');
    expect(result.created).toBe(1000);
    expect(result.updated).toBe(2000);
    expect(result.tags).toEqual(['tag1', 'tag2']);
    expect(result.categoryPath).toBe('Cat/Sub');
    expect(result.summary).toBe('A summary');
    expect(result.title).toBe('My Title');
    expect(result.content).toContain('Body text here');
  });

  it('parseNoteFromMarkdown() handles markdown without frontmatter', () => {
    const md = '# Plain note\n\nNo frontmatter here';
    const result = parseNoteFromMarkdown(md, 'My/Cat');
    expect(result.content).toBe(md);
    expect(result.categoryPath).toBe('My/Cat');
    expect(result.id).toBeUndefined();
  });

  // ── Singleton export ──

  it('exports a singleton instance', () => {
    expect(noteFileSync).toBeDefined();
    expect(noteFileSync).toBeInstanceOf(NoteFileSync);
  });
});
