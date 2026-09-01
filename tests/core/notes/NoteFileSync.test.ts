/**
 * NoteFileSync.test.ts — SYNC-01…07/11, WIKI-ID-01, OKF-WIKI-01/02/03/04,
 * CAT-04, D-119/120 (D-121 restore tests in Task 2).
 *
 * TDD RED phase: these tests define the expected behavior of NoteFileSync
 * before implementation. They cover:
 *   - Test 1 (SYNC-04): OKF v0.2 frontmatter round-trip
 *   - Test 2 (SYNC-04): frontmatter includes type, generated, status
 *   - Test 3 (SYNC-05): title collision → numeric suffix
 *   - Test 4 (SYNC-06): external-change guard (2s tolerance)
 *   - Test 5 (SYNC-07): no backup handle → sync is no-op
 *   - Test 6 (SYNC-11): delete-on-sync removes .md file
 *   - Test 7 (OKF-WIKI-04): no OKF markdown-link edges emitted
 *   - Test 8 (CAT-04): nested categoryPath → nested folder path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note } from '../../../src/types/notes';

// ---------------------------------------------------------------------------
// Mock FileSystemAdapter — in-memory filesystem for testing
// ---------------------------------------------------------------------------

interface MockFile {
  contents: string;
  lastModified: number;
}

interface MockDir {
  files: Map<string, MockFile>;
  dirs: Map<string, MockDir>;
}

function createMockDir(): MockDir {
  return { files: new Map(), dirs: new Map() };
}

function createMockAdapter(root?: MockDir) {
  const theRoot = root ?? createMockDir();

  function getDir(path: string): MockDir {
    if (!path) return theRoot;
    const segments = path.split('/').filter(Boolean);
    let current = theRoot;
    for (const seg of segments) {
      if (!current.dirs.has(seg)) {
        current.dirs.set(seg, createMockDir());
      }
      current = current.dirs.get(seg)!;
    }
    return current;
  }

  return {
    getRoot() {
      return theRoot as unknown as FileSystemDirectoryHandle;
    },
    async ensureDirectory(path: string) {
      return getDir(path) as unknown as FileSystemDirectoryHandle;
    },
    async getFileHandle(dir: FileSystemDirectoryHandle, name: string) {
      const d = dir as unknown as MockDir;
      const file = d.files.get(name);
      if (!file) return null;
      return { name, _file: file } as unknown as FileSystemFileHandle;
    },
    async createFileHandle(dir: FileSystemDirectoryHandle, name: string) {
      const d = dir as unknown as MockDir;
      if (!d.files.has(name)) {
        d.files.set(name, { contents: '', lastModified: Date.now() });
      }
      return { name, _file: d.files.get(name)! } as unknown as FileSystemFileHandle;
    },
    async writeFile(handle: FileSystemFileHandle, contents: string) {
      const file = (handle as any)._file as MockFile;
      file.contents = contents;
      file.lastModified = Date.now();
    },
    async deleteFile(dir: FileSystemDirectoryHandle, name: string) {
      (dir as unknown as MockDir).files.delete(name);
    },
    async listEntries(dir: FileSystemDirectoryHandle) {
      const d = dir as unknown as MockDir;
      const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];
      for (const [name] of d.files) entries.push({ name, kind: 'file' });
      for (const [name] of d.dirs) entries.push({ name, kind: 'directory' });
      return entries;
    },
    async readFile(handle: FileSystemFileHandle) {
      return ((handle as any)._file as MockFile).contents;
    },
    async getLastModified(handle: FileSystemFileHandle) {
      return ((handle as any)._file as MockFile).lastModified;
    },
    async removeDirectoryIfEmpty(dir: FileSystemDirectoryHandle) {
      const d = dir as unknown as MockDir;
      return d.files.size === 0 && d.dirs.size === 0;
    },
    // Helper for tests to inspect the mock filesystem
    _getRoot() {
      return theRoot;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Test Note',
    content: 'This is a test note about ServiceNow incidents.',
    created: 1700000000000,
    updated: 1700000000001,
    tags: [],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NoteFileSync.serializeNoteToMarkdown (SYNC-04, OKF-WIKI-01/02/03)', () => {
  it('round-trips OKF v0.2 frontmatter: id, title, tags, categoryPath preserved', async () => {
    const { serializeNoteToMarkdown, parseNoteFromMarkdown } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const note = makeNote({
      id: 'abc-123',
      title: 'My Note',
      tags: ['svc', 'incident'],
      categoryPath: 'InfoTech/Database',
      summary: 'A summary',
    });
    const md = serializeNoteToMarkdown(note, 'fast');
    const { frontmatter } = parseNoteFromMarkdown(md);

    expect(frontmatter.id).toBe('abc-123');
    expect(frontmatter.title).toBe('My Note');
    expect(frontmatter.tags).toEqual(['svc', 'incident']);
    expect(frontmatter.categoryPath).toBe('InfoTech/Database');
  });

  it('includes type (default "Note"), generated {by, at}, status ("stable")', async () => {
    const { serializeNoteToMarkdown, parseNoteFromMarkdown } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const note = makeNote();
    const md = serializeNoteToMarkdown(note, 'fast');
    const { frontmatter } = parseNoteFromMarkdown(md);

    expect(frontmatter.type).toBe('Note');
    expect(frontmatter.generated.by).toBe('nowpilot/fast');
    expect(typeof frontmatter.generated.at).toBe('string');
    expect(frontmatter.generated.at.length).toBeGreaterThan(0);
    expect(frontmatter.status).toBe('stable');
  });
});

describe('NoteFileSync.syncNoteToFilesystem (SYNC-05/06/07/11, CAT-04, OKF-WIKI-04)', () => {
  it('title collision → numeric suffix (My Note.md, My Note (1).md)', async () => {
    const { syncNoteToFilesystem } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const adapter = createMockAdapter();
    const root = adapter.getRoot();

    // Write first file manually
    const handle1 = await adapter.createFileHandle(root, 'My Note.md');
    await adapter.writeFile(handle1, 'existing');

    // Sync a note with the same title
    const note = makeNote({ title: 'My Note' });
    const result = await syncNoteToFilesystem(
      {} as any,
      adapter as any,
      note,
      'fast',
    );

    expect(result.status).toBe('written');
    // The file should have been written with a collision suffix
    const entries = await adapter.listEntries(root);
    const mdFiles = entries.filter((e) => e.name.endsWith('.md'));
    expect(mdFiles.length).toBe(2);
    const names = mdFiles.map((e) => e.name).sort();
    expect(names).toContain('My Note.md');
    expect(names).toContain('My Note (1).md');
  });

  it('external-change guard: file modified outside 2s tolerance → conflict detected', async () => {
    const { syncNoteToFilesystem } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const adapter = createMockAdapter();
    const root = adapter.getRoot();

    // Write a file with a lastModified far in the future (outside 2s tolerance)
    const handle = await adapter.createFileHandle(root, 'Test Note.md');
    (handle as any)._file.lastModified = Date.now() + 10_000; // 10s in future

    const note = makeNote({ title: 'Test Note' });
    const result = await syncNoteToFilesystem(
      {} as any,
      adapter as any,
      note,
      'fast',
      Date.now(),
    );

    expect(result.status).toBe('conflict');
  });

  it('external-change guard: file modified within 2s tolerance → no conflict', async () => {
    const { syncNoteToFilesystem } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const adapter = createMockAdapter();
    const root = adapter.getRoot();

    // Write a file with lastModified = now (within 2s tolerance)
    const handle = await adapter.createFileHandle(root, 'Test Note.md');
    (handle as any)._file.lastModified = Date.now();

    const note = makeNote({ title: 'Test Note' });
    const result = await syncNoteToFilesystem(
      {} as any,
      adapter as any,
      note,
      'fast',
      Date.now(),
    );

    expect(result.status).toBe('written');
  });

  it('no backup handle → sync is no-op (no throw)', async () => {
    const { syncNoteToFilesystem } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const adapter = createMockAdapter();
    // getRoot() returns a valid handle, but we simulate no-folder by passing null
    const note = makeNote();

    // When adapter.getRoot() returns null, sync should be no-op
    const nullAdapter = {
      ...adapter,
      getRoot() {
        return null;
      },
    };

    const result = await syncNoteToFilesystem(
      {} as any,
      nullAdapter as any,
      note,
      'fast',
    );

    expect(result.status).toBe('no-folder');
  });

  it('delete-on-sync removes .md file', async () => {
    const { deleteFromSync } = await import('../../../src/core/notes/NoteFileSync');
    const adapter = createMockAdapter();
    const root = adapter.getRoot();

    // Write a file
    const handle = await adapter.createFileHandle(root, 'Test Note.md');
    await adapter.writeFile(handle, 'content');

    const note = makeNote({ title: 'Test Note' });
    await deleteFromSync(adapter as any, note, 'Test Note.md');

    const entries = await adapter.listEntries(root);
    const mdFiles = entries.filter((e) => e.name.endsWith('.md'));
    expect(mdFiles.length).toBe(0);
  });

  it('serialized output does NOT contain OKF markdown-link edges (OKF-WIKI-04)', async () => {
    const { serializeNoteToMarkdown } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const note = makeNote({
      content: 'This note links to [[Another Note]] and [[Third Note]].',
    });
    const md = serializeNoteToMarkdown(note, 'fast');

    // Wikilinks stay in the body
    expect(md).toContain('[[Another Note]]');
    expect(md).toContain('[[Third Note]]');

    // No OKF markdown-link edges emitted (no "links:" array in frontmatter)
    const frontmatterBlock = md.split('---')[1];
    expect(frontmatterBlock).not.toContain('links:');
    expect(frontmatterBlock).not.toContain('- targetId:');
  });

  it('note at InfoTech/Database/MySQL saves as InfoTech/Database/MySQL/Note Title.md (CAT-04)', async () => {
    const { syncNoteToFilesystem } = await import(
      '../../../src/core/notes/NoteFileSync'
    );
    const adapter = createMockAdapter();
    const root = adapter.getRoot();

    const note = makeNote({
      title: 'Note Title',
      categoryPath: 'InfoTech/Database/MySQL',
    });
    const result = await syncNoteToFilesystem(
      {} as any,
      adapter as any,
      note,
      'fast',
    );

    expect(result.status).toBe('written');
    expect(result.path).toBe('InfoTech/Database/MySQL/Note Title.md');

    // Verify the file exists at the nested path
    const dbDir = await adapter.ensureDirectory('InfoTech/Database/MySQL');
    const handle = await adapter.getFileHandle(dbDir, 'Note Title.md');
    expect(handle).not.toBeNull();
  });
});
