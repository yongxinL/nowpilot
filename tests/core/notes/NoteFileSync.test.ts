import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { openDB } from 'idb';
import { resetNotesDb, getNotesDb } from '../../../src/core/notes/NotesDB';
import { resetJournalDb } from '../../../src/core/storage/WriteJournal';
import { resetMigrationDb } from '../../../src/core/storage/MigrationRunner';
import {
  getNoteFileSync,
  resetNoteFileSync,
  sanitizeFilename,
  buildFilePath,
  buildNoteFile,
  parseNoteFile,
  verifyPermission,
  isNativeHandle,
  DEBOUNCE_MS,
  EXTERNAL_CHANGE_TOLERANCE_MS,
  BACKUP_CONFIG_KEY,
  type SyncErrorEvent,
  type ExternalChangeEvent,
} from '../../../src/core/notes/NoteFileSync';
import { emit, on, hasListeners } from '../../../src/core/events/EventBus';
import type { Note } from '../../../src/core/notes/NoteSchema';

// ── Test doubles for the File System Access API ─────────────────────────────
// Methods MUST live on the class prototype (not own enumerable props): the
// handle is persisted through IndexedDB's structured clone, which throws
// DataCloneError on own functions — exactly like the real
// FileSystemDirectoryHandle platform object.

type MockPermissionState = 'granted' | 'denied' | 'prompt';

class MockFileHandle {
  readonly kind = 'file' as const;
  name: string;
  lastModified: number;
  content: string;
  writeCount = 0;

  constructor(name: string, content = '', lastModified = Date.now() - 1000) {
    this.name = name;
    this.content = content;
    this.lastModified = lastModified;
  }

  getFile(): Promise<File> {
    return Promise.resolve({
      lastModified: this.lastModified,
      text: async () => this.content,
    } as unknown as File);
  }

  createWritable(): Promise<{ write: (chunk: string) => Promise<void>; close: () => Promise<void> }> {
    return Promise.resolve({
      write: async (chunk: string) => {
        this.content = chunk;
        this.writeCount++;
        this.lastModified = Date.now(); // browser bumps mtime on write
      },
      close: async () => {},
    });
  }
}

class MockDirHandle {
  readonly kind = 'directory' as const;
  name: string;
  permissionState: MockPermissionState;
  children = new Map<string, MockDirHandle | MockFileHandle>();
  parent: MockDirHandle | null;
  removeEntryCalls: string[] = [];

  constructor(name: string, parent: MockDirHandle | null = null, permissionState: MockPermissionState = 'granted') {
    this.name = name;
    this.parent = parent;
    this.permissionState = permissionState;
  }

  queryPermission(): Promise<MockPermissionState> {
    return Promise.resolve(this.permissionState);
  }

  requestPermission(): Promise<MockPermissionState> {
    return Promise.resolve(this.permissionState);
  }

  getDirectoryHandle(segment: string, options?: { create?: boolean }): Promise<MockDirHandle> {
    const existing = this.children.get(segment);
    if (existing?.kind === 'directory') return Promise.resolve(existing);
    if (options?.create) {
      const child = new MockDirHandle(segment, this, this.permissionState);
      this.children.set(segment, child);
      return Promise.resolve(child);
    }
    return Promise.reject(new DOMException('Not found', 'NotFoundError'));
  }

  getFileHandle(fileName: string, options?: { create?: boolean }): Promise<MockFileHandle> {
    const existing = this.children.get(fileName);
    if (existing?.kind === 'file') return Promise.resolve(existing);
    if (options?.create) {
      const file = new MockFileHandle(fileName);
      this.children.set(fileName, file);
      return Promise.resolve(file);
    }
    return Promise.reject(new DOMException('Not found', 'NotFoundError'));
  }

  removeEntry(entryName: string): Promise<void> {
    this.removeEntryCalls.push(entryName);
    const entry = this.children.get(entryName);
    if (entry?.kind === 'directory') {
      if ((entry as MockDirHandle).children.size > 0) {
        return Promise.reject(new DOMException('Not empty', 'InvalidModificationError'));
      }
      this.children.delete(entryName);
      return Promise.resolve();
    }
    this.children.delete(entryName);
    return Promise.resolve();
  }

  async *values(): AsyncGenerator<MockDirHandle | MockFileHandle> {
    yield* this.children.values();
  }
}

/** A full backup-folder tree with a category subdirectory. */
function makeBackupFs(permissionState: MockPermissionState = 'granted'): {
  root: MockDirHandle;
  categoryDir: MockDirHandle;
} {
  const root = new MockDirHandle('backup', null, permissionState);
  const categoryDir = new MockDirHandle('Inbox', root, permissionState);
  root.children.set('Inbox', categoryDir);
  return { root, categoryDir };
}

/**
 * Native-shaped directory handle: duck-types as a real
 * FileSystemDirectoryHandle (isSameEntry + Symbol.asyncIterator) while
 * backing writes with the same class-based tree as MockDirHandle. Used to
 * exercise the CR-01 native branch of persistHandle/loadPersistedHandle.
 */
class NativeMockDirHandle extends MockDirHandle {
  isSameEntry(): Promise<boolean> {
    return Promise.resolve(false);
  }

  [Symbol.asyncIterator]() {
    return this.values();
  }
}

/** Backup-folder tree whose handles duck-type as native platform objects. */
function makeNativeBackupFs(permissionState: MockPermissionState = 'granted'): {
  root: NativeMockDirHandle;
  categoryDir: NativeMockDirHandle;
} {
  const root = new NativeMockDirHandle('backup', null, permissionState);
  const categoryDir = new NativeMockDirHandle('Inbox', root, permissionState);
  root.children.set('Inbox', categoryDir);
  return { root, categoryDir };
}

/** Read the raw persisted backup_config record (bypasses rehydration). */
async function readBackupConfig(): Promise<{ handle: unknown } | null> {
  const db = await openDB('NotesDB', 5);
  try {
    return (await db.get('backup_config', BACKUP_CONFIG_KEY)) as { handle: unknown } | null;
  } finally {
    db.close();
  }
}

function addFile(
  dir: MockDirHandle,
  fileName: string,
  content: string,
  lastModified = Date.now() - 1000,
): MockFileHandle {
  const file = new MockFileHandle(fileName, content, lastModified);
  dir.children.set(fileName, file);
  return file;
}

let pickerStub: ReturnType<typeof vi.fn>;

const uuid = (): string => crypto.randomUUID();

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: uuid(),
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

const fm = (overrides: Record<string, unknown> = {}): string => {
  const tags: string[] = (overrides.tags as string[] | undefined) ?? [];
  return `---\n${[
    `id: "${overrides.id ?? uuid()}"`,
    `title: "${overrides.title ?? 'Restored Note'}"`,
    `created: ${overrides.created ?? 1000}`,
    `updated: ${overrides.updated ?? 1000}`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    `categoryPath: "${overrides.categoryPath ?? ''}"`,
    `summary: ${overrides.summary ? `"${overrides.summary}"` : 'null'}`,
  ].join('\n')}\n---\n\n${overrides.body ?? 'Body content'}`;
};

describe('NoteFileSync', () => {
  beforeAll(() => {
    pickerStub = vi.fn();
    vi.stubGlobal('showDirectoryPicker', pickerStub);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    await resetNotesDb();
    await resetJournalDb();
    await resetMigrationDb('NotesDB');
    resetNoteFileSync();
    pickerStub.mockReset();
  });

  afterEach(() => {
    resetNoteFileSync();
    vi.useRealTimers();
  });

  // ── YAML frontmatter ───────────────────────────────────────────────────────

  it('buildNoteFile produces valid YAML frontmatter with all fields', () => {
    const note = makeNote({
      title: 'Meeting Notes',
      createdAt: 111,
      updatedAt: 222,
      tags: ['work', 'sync'],
      categoryPath: 'Projects/Alpha',
      summary: 'A short summary',
    });
    const out = buildNoteFile(note);
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('\n---\n\n');
    const { frontmatter, body } = parseNoteFile(out);
    expect(frontmatter.id).toBe(note.id);
    expect(frontmatter.title).toBe('Meeting Notes');
    expect(frontmatter.created).toBe(111);
    expect(frontmatter.updated).toBe(222);
    expect(frontmatter.tags).toEqual(['work', 'sync']);
    expect(frontmatter.categoryPath).toBe('Projects/Alpha');
    expect(frontmatter.summary).toBe('A short summary');
    expect(body).toBe('Plain content without links');
  });

  it('parseNoteFile parses YAML frontmatter back into an object (round-trip)', () => {
    const note = makeNote({ title: 'Round Trip', tags: ['a'], summary: 'S' });
    const out = buildNoteFile(note);
    const parsed = parseNoteFile(out);
    expect(parsed.frontmatter).toMatchObject({
      id: note.id,
      title: 'Round Trip',
      tags: ['a'],
      summary: 'S',
    });
  });

  it('parseNoteFile throws when no frontmatter exists', () => {
    expect(() => parseNoteFile('just a body\nno frontmatter')).toThrow();
  });

  // ── Filename sanitization ──────────────────────────────────────────────────

  it('sanitizeFilename replaces invalid chars with underscore', () => {
    expect(sanitizeFilename('Meeting: Q3 Review')).toBe('Meeting_ Q3 Review');
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('sanitizeFilename handles empty and whitespace-only strings', () => {
    expect(sanitizeFilename('')).toBe('untitled');
    expect(sanitizeFilename('   ')).toBe('untitled');
  });

  it('buildFilePath joins categoryPath and sanitized title', () => {
    expect(buildFilePath('Projects/Notes', 'My: Note')).toBe('Projects/Notes/My_ Note.md');
    expect(buildFilePath('', 'Top Level')).toBe('Top Level.md');
  });

  // ── Collision resolution ───────────────────────────────────────────────────

  it('collision: duplicate title resolves to numeric suffix', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    // First note with this title syncs to the canonical file.
    const first = makeNote({ title: 'My Note', categoryPath: 'Inbox', lastSyncedAt: Date.now() });
    await getNotesDb().restore(first);
    await sync.syncNote(first.id);
    const canonical = fs.categoryDir.children.get('My Note.md') as MockFileHandle;
    expect(canonical).toBeDefined();
    expect(canonical.content).toContain('Plain content without links');
    expect(fs.categoryDir.children.has('My Note 1.md')).toBe(false);

    // Second note with the same title (different id, never synced) — the
    // existing file reads as externally-modified, so it must NOT overwrite:
    // it collides to a suffixed file (D-12 / SYNC-05).
    const second = makeNote({ title: 'My Note', categoryPath: 'Inbox' });
    await getNotesDb().restore(second);
    await sync.syncNote(second.id);

    const collided = fs.categoryDir.children.get('My Note 1.md') as MockFileHandle;
    expect(collided).toBeDefined();
    expect(collided.writeCount).toBe(1);
    expect(collided.content).toContain('Plain content without links');
    expect(collided.content).toContain(second.id); // second note's frontmatter
  });

  // ── Ownership-aware collision (CR-02) + owned-file reuse (WR-04) ──────────

  it('CR-02: a different note never overwrites the canonical file; re-saves reuse its own suffixed file', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const now = Date.now();
    const noteA = makeNote({ title: 'React', categoryPath: 'Inbox', lastSyncedAt: now });
    await getNotesDb().restore(noteA);
    await sync.syncNote(noteA.id);
    const canonical = fs.categoryDir.children.get('React.md') as MockFileHandle;
    expect(canonical).toBeDefined();
    const canonicalContentA = canonical.content;

    // B collides to React 1.md — A's canonical file untouched.
    const noteB = makeNote({ title: 'React', categoryPath: 'Inbox' });
    await getNotesDb().restore(noteB);
    await sync.syncNote(noteB.id);
    const collided = fs.categoryDir.children.get('React 1.md') as MockFileHandle;
    expect(collided).toBeDefined();
    expect(collided.content).toContain(noteB.id);
    expect(canonical.content).toBe(canonicalContentA);
    expect(canonical.content).toContain(noteA.id);

    // B re-saves → reuses its own React 1.md (no new suffix, no canonical
    // ping-pong); React.md keeps A's content AND frontmatter id. Re-save via
    // save() (the app path) — it preserves lastSyncedAt/lastSyncedFileName.
    const updatedB = { ...noteB, content: 'B content v2' };
    await getNotesDb().save(updatedB);
    await sync.syncNote(noteB.id);
    expect(collided.content).toContain('B content v2');
    expect(collided.content).toContain(noteB.id);
    expect(fs.categoryDir.children.has('React 2.md')).toBe(false);
    expect(canonical.content).toBe(canonicalContentA);
    expect(canonical.content).toContain(noteA.id);
  });

  it('WR-04: an externally modified owned file gets a fresh suffix; its content is untouched', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const now = Date.now();
    const noteA = makeNote({ title: 'React', categoryPath: 'Inbox', lastSyncedAt: now });
    await getNotesDb().restore(noteA);
    await sync.syncNote(noteA.id);

    const noteB = makeNote({ title: 'React', categoryPath: 'Inbox' });
    await getNotesDb().restore(noteB);
    await sync.syncNote(noteB.id);
    const owned = fs.categoryDir.children.get('React 1.md') as MockFileHandle;
    expect(owned).toBeDefined();

    // User edits B's owned file externally (newer than B.lastSyncedAt + 2s).
    owned.lastModified = Date.now() + 5000;
    owned.content = 'externally edited by user';
    owned.writeCount = 0;

    await sync.syncNote(noteB.id);

    const fresh = fs.categoryDir.children.get('React 2.md') as MockFileHandle;
    expect(fresh).toBeDefined();
    expect(fresh.content).toContain(noteB.id);
    expect(owned.content).toBe('externally edited by user'); // untouched
    expect(owned.writeCount).toBe(0);
  });

  it('D-18: the same note re-sync overwrites its own canonical file without a suffix', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const noteA = makeNote({ title: 'React', categoryPath: 'Inbox', content: 'v1' });
    await getNotesDb().restore(noteA);
    await sync.syncNote(noteA.id);
    const canonical = fs.categoryDir.children.get('React.md') as MockFileHandle;
    expect(canonical).toBeDefined();

    await getNotesDb().save({ ...noteA, content: 'v2' });
    await sync.syncNote(noteA.id);
    expect(fs.categoryDir.children.has('React 1.md')).toBe(false);
    expect(canonical.content).toContain('v2');
    expect(canonical.content).toContain(noteA.id);
  });

  it('CR-02: the collision scan skips a suffixed file owned by a third note', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    // React.md belongs to note A (canonical write) and React 1.md already
    // belongs to note C (its frontmatter id) — B's collision scan must skip
    // both foreign-owned files and pick React 2.md.
    const now = Date.now();
    const noteA = makeNote({ title: 'React', categoryPath: 'Inbox', lastSyncedAt: now });
    await getNotesDb().restore(noteA);
    await sync.syncNote(noteA.id);

    const noteC = makeNote({ title: 'React', categoryPath: 'Inbox' });
    await getNotesDb().restore(noteC);
    addFile(fs.categoryDir, 'React 1.md', fm({ id: noteC.id, title: 'React' }), Date.now() + 10000);

    const noteB = makeNote({ title: 'React', categoryPath: 'Inbox' });
    await getNotesDb().restore(noteB);
    await sync.syncNote(noteB.id);

    const second = fs.categoryDir.children.get('React 2.md') as MockFileHandle;
    expect(second).toBeDefined();
    expect(second.content).toContain(noteB.id);
    expect((fs.categoryDir.children.get('React 1.md') as MockFileHandle).content).toContain(noteC.id);
    expect((fs.categoryDir.children.get('React.md') as MockFileHandle).content).toContain(noteA.id);
  });

  // ── Permission ─────────────────────────────────────────────────────────────

  it('syncNote skips write when permission is denied', async () => {
    const fs = makeBackupFs('denied');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();
    expect(sync.getSyncStatus().enabled).toBe(false);

    const note = makeNote();
    await getNotesDb().restore(note);

    // syncNote returns early because setBackupFolder already disabled sync —
    // no event emitted, no write attempted, nothing created in the tree.
    await sync.syncNote(note.id);
    const anyFileCreated = [...fs.root.children.values()].some((c) => c.kind === 'file');
    expect(anyFileCreated).toBe(false);
    expect(sync.getSyncStatus().enabled).toBe(false);
  });

  it('syncNote succeeds when permission is granted', async () => {
    const fs = makeBackupFs('granted');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const note = makeNote({ title: 'Granted Write', categoryPath: 'Inbox' });
    await getNotesDb().restore(note);

    await sync.syncNote(note.id);

    const file = fs.categoryDir.children.get('Granted Write.md') as MockFileHandle;
    expect(file).toBeDefined();
    expect(file.writeCount).toBe(1);
    expect(file.content).toContain('Plain content without links');
    const after = await getNotesDb().get(note.id);
    const afterNote = after.success ? after.note : null;
    expect(afterNote !== null && typeof afterNote.lastSyncedAt === 'number').toBe(true);
  });

  // ── External change detection (D-11) ───────────────────────────────────────

  it('syncNote detects external change and skips write', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const note = makeNote({
      title: 'External Note',
      categoryPath: 'Inbox',
      lastSyncedAt: 1000,
      updatedAt: 2000,
    });
    await getNotesDb().restore(note);

    const externalModified = 1000 + EXTERNAL_CHANGE_TOLERANCE_MS + 10000;
    const existing = addFile(fs.categoryDir, 'External Note.md', 'externally edited', externalModified);

    const events: ExternalChangeEvent[] = [];
    const unsub = on<ExternalChangeEvent>('sync:external-change', (e) => events.push(e));
    await sync.syncNote(note.id);
    unsub();

    expect(events.length).toBe(1);
    expect(events[0].noteId).toBe(note.id);
    expect(events[0].localModified).toBe(2000);
    expect(events[0].fileModified).toBe(externalModified);
    expect(existing.content).toBe('externally edited'); // untouched
    expect(existing.writeCount).toBe(0);
  });

  it('syncNote writes when file is not newer', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const note = makeNote({ title: 'Stale File', categoryPath: 'Inbox', lastSyncedAt: 5000 });
    await getNotesDb().restore(note);
    const existing = addFile(fs.categoryDir, 'Stale File.md', 'old content', 4000);

    await sync.syncNote(note.id);

    expect(existing.content).toContain('Plain content without links'); // overwritten
    expect(existing.writeCount).toBe(1);
  });

  // ── Debounce ───────────────────────────────────────────────────────────────

  it('multiple rapid saves debounce to a single write', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const note = makeNote({ title: 'Debounced', categoryPath: 'Inbox' });
    await getNotesDb().restore(note);

    const spy = vi.spyOn(sync, 'syncNote').mockResolvedValue(undefined);
    vi.spyOn(sync, 'loadPersistedHandle').mockResolvedValue(null);

    // fake timers only AFTER all async DB/handle setup completes — the
    // IndexedDB shim and idb need the real event loop to resolve.
    vi.useFakeTimers();
    sync.initNoteFileSync();

    emit('note:saved', { noteId: note.id });
    await vi.advanceTimersByTimeAsync(30);
    emit('note:saved', { noteId: note.id });
    await vi.advanceTimersByTimeAsync(30);
    emit('note:saved', { noteId: note.id });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 10);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(note.id);

    spy.mockRestore();
  });

  // ── EventBus subscription ──────────────────────────────────────────────────

  it('initNoteFileSync subscribes to note:saved', () => {
    const sync = getNoteFileSync();
    sync.initNoteFileSync();
    expect(hasListeners('note:saved')).toBe(true);
    resetNoteFileSync();
    expect(hasListeners('note:saved')).toBe(false);
  });

  it('loadPersistedHandle rehydrates a functional handle', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const loaded = await sync.loadPersistedHandle();
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('backup');
    // rehydrated handle is usable
    const sub = await (loaded as unknown as MockDirHandle).getDirectoryHandle('sub', { create: true });
    expect(sub.name).toBe('sub');
  });

  // ── CR-01: native-handle persistence (structured clone, no snapshot) ──────

  it('native-shaped handle persists natively and sync resumes after a simulated restart (CR-01)', async () => {
    const fs = makeNativeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();

    // The browser structured-clones a native FileSystemHandle into a LIVE
    // handle (identity-preserving). fake-indexeddb's structured clone cannot
    // reproduce platform-object behavior, so emulate it for the duck-typed
    // native branch only — everything else uses the real clone. The value
    // being cloned is the `{ id, handle }` record, so unwrap to the handle.
    const realStructuredClone = globalThis.structuredClone;
    const identityCloneForNative = (value: unknown): unknown => {
      const handle = (value as { handle?: unknown })?.handle ?? value;
      return isNativeHandle(handle as FileSystemDirectoryHandle) ? value : realStructuredClone(value);
    };
    (globalThis as unknown as { structuredClone: typeof realStructuredClone }).structuredClone =
      identityCloneForNative;

    try {
      await sync.setBackupFolder();
      expect(sync.getSyncStatus().enabled).toBe(true);

      // The persisted record holds the handle itself — NOT a plain-data
      // snapshot (no `children` array on the stored record.handle).
      const record = await readBackupConfig();
      expect(record).not.toBeNull();
      expect(Array.isArray((record!.handle as { children?: unknown }).children)).toBe(false);
      expect(typeof (record!.handle as { getDirectoryHandle?: unknown }).getDirectoryHandle).toBe('function');

      // Simulated extension restart: drop the singleton, start fresh, and
      // restore the session from the persisted handle — no re-selection.
      resetNoteFileSync();
      const restarted = getNoteFileSync();
      restarted.initNoteFileSync();
      await vi.waitFor(() => expect(restarted.getSyncStatus().enabled).toBe(true));

      // Writes reach the filesystem-backed mock tree — not a phantom copy.
      const note = makeNote({ title: 'Native Round Trip', categoryPath: 'Inbox' });
      await getNotesDb().restore(note);
      await restarted.syncNote(note.id);
      const file = fs.categoryDir.children.get('Native Round Trip.md') as MockFileHandle;
      expect(file).toBeDefined();
      expect(file.writeCount).toBe(1);
      expect(file.content).toContain('Plain content without links');
      expect(file.content).toContain(note.id);
    } finally {
      (globalThis as unknown as { structuredClone: typeof realStructuredClone }).structuredClone =
        realStructuredClone;
    }
  });

  it('restoreSession resumes sync with a rehydrated snapshot double (D-10 preserved)', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    // Simulated restart: the snapshot path rehydrates a functional double
    // whose queryPermission returns the stored permissionState. Capture the
    // exact rehydrated tree restoreSession will load (each rehydrateHandle
    // call builds its own tree) and pin it via a spy so the write and the
    // read assertions address the same tree.
    const restarted = getNoteFileSync();
    const loaded = await restarted.loadPersistedHandle();
    expect(loaded).not.toBeNull();
    vi.spyOn(restarted, 'loadPersistedHandle').mockResolvedValue(loaded);
    restarted.initNoteFileSync();
    await vi.waitFor(() => expect(restarted.getSyncStatus().enabled).toBe(true));

    const note = makeNote({ title: 'Rehydrated Resume', categoryPath: 'Inbox' });
    await getNotesDb().restore(note);
    await restarted.syncNote(note.id);

    // The write landed in the rehydrated tree that restoreSession loaded —
    // reachable through the handle's own API.
    const inbox = await loaded!.getDirectoryHandle('Inbox');
    const fileHandle = await inbox.getFileHandle('Rehydrated Resume.md');
    const file = await fileHandle.getFile();
    expect(await file.text()).toContain('Plain content without links');
  });

  // ── Restore ────────────────────────────────────────────────────────────────

  it('restoreFromFolder returns correct preview counts and upserts', async () => {
    const folder = new MockDirHandle('backup');
    const sub = new MockDirHandle('sub', folder);
    folder.children.set('sub', sub);

    const existing1 = makeNote({ title: 'Existing One', updatedAt: 100 });
    const existing2 = makeNote({ title: 'Existing Two', updatedAt: 100 });
    await getNotesDb().restore(existing1);
    await getNotesDb().restore(existing2);

    const newNote1 = uuid();
    const newNote2 = uuid();
    const upd1 = uuid();
    const upd2 = uuid();
    const unch = uuid();

    addFile(sub, 'new1.md', fm({ id: newNote1, title: 'New One' }));
    addFile(folder, 'new2.md', fm({ id: newNote2, title: 'New Two' }));
    addFile(folder, 'upd1.md', fm({ id: upd1, title: 'Upd One', updated: 5000 }));
    addFile(folder, 'upd2.md', fm({ id: upd2, title: 'Upd Two', updated: 6000 }));
    addFile(folder, 'unchanged.md', fm({ id: unch, title: 'Unchanged', updated: 50 }));
    await getNotesDb().restore(makeNote({ id: upd1, title: 'Upd One', updatedAt: 1000 }));
    await getNotesDb().restore(makeNote({ id: upd2, title: 'Upd Two', updatedAt: 1000 }));
    await getNotesDb().restore(makeNote({ id: unch, title: 'Unchanged', updatedAt: 5000 }));

    pickerStub.mockResolvedValue(folder);
    const sync = getNoteFileSync();
    const result = await sync.restoreFromFolder();

    expect(result.preview).toEqual({
      total: 5,
      newCount: 2,
      updatedCount: 2,
      unchangedCount: 1,
      skippedCount: 0,
    });
    const actions = new Map(result.notes.map((n) => [n.noteId, n.action]));
    expect(actions.get(newNote1)).toBe('new');
    expect(actions.get(newNote2)).toBe('new');
    expect(actions.get(upd1)).toBe('updated');
    expect(actions.get(upd2)).toBe('updated');
    expect(actions.get(unch)).toBe('unchanged');

    const created = await getNotesDb().get(newNote1);
    const createdNote = created.success ? created.note : null;
    expect(createdNote?.title).toBe('New One');
    expect(createdNote?.content).toBe('Body content');

    const updated = await getNotesDb().get(upd1);
    const updatedNote = updated.success ? updated.note : null;
    expect(updatedNote?.title).toBe('Upd One');
    expect(updatedNote?.content).toBe('Body content');

    const existingOne = await getNotesDb().get(existing1.id);
    const existingOneNote = existingOne.success ? existingOne.note : null;
    expect(existingOneNote?.title).toBe('Existing One');
  });

  it('restore never deletes local notes absent from the folder', async () => {
    const folder = new MockDirHandle('backup');
    addFile(folder, 'only.md', fm({ title: 'Only Note' }));

    const local = makeNote({ title: 'Local Only' });
    await getNotesDb().restore(local);

    pickerStub.mockResolvedValue(folder);
    const sync = getNoteFileSync();
    const result = await sync.restoreFromFolder();

    expect(result.preview.total).toBe(1);
    const stillThere = await getNotesDb().get(local.id);
    const stillThereNote = stillThere.success ? stillThere.note : null;
    expect(stillThereNote?.title).toBe('Local Only');
  });

  it('restore from empty folder returns zero counts', async () => {
    const folder = new MockDirHandle('backup');
    pickerStub.mockResolvedValue(folder);
    const result = await getNoteFileSync().restoreFromFolder();
    expect(result.preview).toEqual({
      total: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      skippedCount: 0,
    });
  });

  it('restore skips malformed .md files without crashing', async () => {
    const folder = new MockDirHandle('backup');
    addFile(folder, 'bad.md', 'no frontmatter here');
    const goodId = uuid();
    addFile(folder, 'good.md', fm({ id: goodId, title: 'Good' }));
    pickerStub.mockResolvedValue(folder);

    const result = await getNoteFileSync().restoreFromFolder();
    expect(result.preview.skippedCount).toBe(1);
    expect(result.preview.total).toBe(1);
    const created = await getNotesDb().get(goodId);
    expect(created.success).toBe(true);
  });

  it('restore skips invalid and duplicate UUID ids', async () => {
    const folder = new MockDirHandle('backup');
    addFile(folder, 'bad-id.md', fm({ id: 'not-a-uuid', title: 'Bad' }));
    const dupId = uuid();
    addFile(folder, 'dup1.md', fm({ id: dupId, title: 'First' }));
    addFile(folder, 'dup2.md', fm({ id: dupId, title: 'Second' }));
    pickerStub.mockResolvedValue(folder);

    const result = await getNoteFileSync().restoreFromFolder();
    expect(result.preview.skippedCount).toBe(2); // invalid + duplicate
    expect(result.preview.total).toBe(1);
    const created = await getNotesDb().get(dupId);
    const createdNote = created.success ? created.note : null;
    expect(createdNote?.title).toBe('First');
  });

  // ── Rename / delete cleanup (D-12) ─────────────────────────────────────────

  it('handleNoteRename deletes the old .md', async () => {
    const fs = makeBackupFs();
    const old = addFile(fs.categoryDir, 'Old Title.md', 'old');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    await sync.handleNoteRename(uuid(), 'Inbox/Old Title.md');
    expect(fs.categoryDir.removeEntryCalls).toContain('Old Title.md');
    expect(fs.categoryDir.children.has('Old Title.md')).toBe(false);
    expect(old.writeCount).toBe(0);
  });

  it('handleNoteDelete removes file and empty parent folders', async () => {
    const fs = makeBackupFs();
    addFile(fs.categoryDir, 'Doomed.md', 'content');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    await sync.handleNoteDelete(uuid(), 'Inbox/Doomed.md');
    expect(fs.categoryDir.children.has('Doomed.md')).toBe(false);
    expect(fs.root.children.has('Inbox')).toBe(false);
    expect(fs.root.removeEntryCalls).toContain('Inbox');
  });

  it('handleNoteDelete preserves non-empty parent folders', async () => {
    const fs = makeBackupFs();
    addFile(fs.categoryDir, 'Doomed.md', 'content');
    addFile(fs.categoryDir, 'Survivor.md', 'stays');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    await sync.handleNoteDelete(uuid(), 'Inbox/Doomed.md');
    expect(fs.categoryDir.children.has('Doomed.md')).toBe(false);
    expect(fs.root.children.has('Inbox')).toBe(true); // not empty → kept
  });

  // ── Re-sync on enrichment acceptance (D-18) ────────────────────────────────

  it('re-sync after enrichment acceptance writes updated frontmatter', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const note = makeNote({ title: 'Enrich Me', categoryPath: 'Inbox', content: 'v1' });
    await getNotesDb().restore(note);
    await sync.syncNote(note.id);
    const file = fs.categoryDir.children.get('Enrich Me.md') as MockFileHandle;
    expect(file.content).toContain('"summary": null');

    // user accepts enrichment → note saved again → note:saved → re-sync.
    // save() (not restore()) so lastSyncedAt survives the edit — the app
    // preserves it across saves, keeping the file non-externally-modified.
    const enriched = { ...note, tags: ['ai', 'enriched'], summary: 'Accepted summary' };
    await getNotesDb().save(enriched);
    await sync.syncNote(note.id);

    const rewritten = fs.categoryDir.children.get('Enrich Me.md') as MockFileHandle;
    expect(rewritten.content).toContain('"summary": "Accepted summary"');
    expect(rewritten.content).toContain('"ai"');
    expect(rewritten.content).toContain('"enriched"');
  });

  // ── getSyncStatus ──────────────────────────────────────────────────────────

  it('getSyncStatus reports granted state with handle and lastSyncAt', async () => {
    const fs = makeBackupFs('granted');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();
    const note = makeNote({ title: 'Status Note' });
    await getNotesDb().restore(note);
    await sync.syncNote(note.id);

    const status = sync.getSyncStatus();
    expect(status.enabled).toBe(true);
    expect(status.handleExists).toBe(true);
    expect(status.permissionState).toBe('granted');
    expect(typeof status.lastSyncAt).toBe('number');
    expect(status.error).toBeUndefined();
  });

  it('getSyncStatus reports denied state', async () => {
    const fs = makeBackupFs('denied');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();
    expect(sync.getSyncStatus().enabled).toBe(false);
    expect(sync.getSyncStatus().permissionState).toBe('denied');
  });

  it('getSyncStatus reports no-handle state', () => {
    const sync = getNoteFileSync();
    sync.resetRuntimeState();
    const status = sync.getSyncStatus();
    expect(status.enabled).toBe(false);
    expect(status.handleExists).toBe(false);
  });

  // ── Handle expiry + recovery ───────────────────────────────────────────────

  it('handle expiry emits sync:error and disables sync', async () => {
    const fs = makeBackupFs('granted');
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();
    expect(sync.getSyncStatus().enabled).toBe(true);

    // simulate permission revoked by the browser
    fs.root.permissionState = 'denied';
    fs.categoryDir.permissionState = 'denied';

    await sync.checkPermission();

    expect(sync.getSyncStatus().enabled).toBe(false);
    expect(sync.getSyncStatus().permissionState).toBe('denied');
  });

  it('re-select folder after expiry re-enables sync', async () => {
    const sync = getNoteFileSync();
    const fs = makeBackupFs('granted');
    pickerStub.mockResolvedValue(fs.root);
    await sync.setBackupFolder();
    expect(sync.getSyncStatus().enabled).toBe(true);

    // revoke then re-select a fresh folder
    fs.root.permissionState = 'denied';
    await sync.checkPermission();
    expect(sync.getSyncStatus().enabled).toBe(false);

    const fresh = makeBackupFs('granted');
    pickerStub.mockResolvedValue(fresh.root);
    const result = await sync.setBackupFolder();
    expect(result.success).toBe(true);
    expect(sync.getSyncStatus().enabled).toBe(true);
    expect(sync.getSyncStatus().permissionState).toBe('granted');
  });

  // ── YAML special characters (Pitfall 4) ───────────────────────────────────

  it('YAML round-trip preserves colon, hash, and emoji in title and content', () => {
    const note = makeNote({
      title: 'Meeting: Q3 Review #1 😀',
      content: '- leading dash\n[ bracket\n{ brace\nemoji 🚀 content',
      summary: 'Summary: with # hash 😀',
    });
    const out = buildNoteFile(note);
    const parsed = parseNoteFile(out);
    expect(parsed.frontmatter.title).toBe('Meeting: Q3 Review #1 😀');
    expect(parsed.frontmatter.summary).toBe('Summary: with # hash 😀');
    expect(parsed.body).toBe('- leading dash\n[ bracket\n{ brace\nemoji 🚀 content');
  });

  // ── Sync edge cases ────────────────────────────────────────────────────────

  it('syncNote with non-existent noteId returns silently', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();
    await expect(sync.syncNote(uuid())).resolves.toBeUndefined();
  });

  it('syncNote with null handle returns silently', () => {
    const sync = getNoteFileSync();
    sync.resetRuntimeState();
    return expect(sync.syncNote(uuid())).resolves.toBeUndefined();
  });

  it('syncNote with NotAllowedError disables sync and emits error', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const note = makeNote({ title: 'Blocked', categoryPath: 'Inbox' });
    await getNotesDb().restore(note);

    // sabotage the write path
    const category = fs.root.children.get('Inbox') as MockDirHandle;
    const original = category.getFileHandle.bind(category);
    category.getFileHandle = (fileName, options) => {
      if (options?.create) {
        return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      }
      return original(fileName, options);
    };

    const errors: SyncErrorEvent[] = [];
    const unsub = on<SyncErrorEvent>('sync:error', (e) => errors.push(e));
    await sync.syncNote(note.id);
    unsub();

    expect(errors.length).toBe(1);
    expect(errors[0].reason).toBe('not_allowed');
    expect(sync.getSyncStatus().enabled).toBe(false);
  });

  it('deep category path creates nested directories recursively', async () => {
    const fs = makeBackupFs();
    pickerStub.mockResolvedValue(fs.root);
    const sync = getNoteFileSync();
    await sync.setBackupFolder();

    const note = makeNote({
      title: 'Deep Note',
      categoryPath: 'projects/nowpilot/features/notes',
    });
    await getNotesDb().restore(note);
    await sync.syncNote(note.id);

    const project = fs.root.children.get('projects') as MockDirHandle;
    expect(project).toBeDefined();
    const nowpilot = project.children.get('nowpilot') as MockDirHandle;
    expect(nowpilot).toBeDefined();
    const features = nowpilot.children.get('features') as MockDirHandle;
    expect(features).toBeDefined();
    const notes = features.children.get('notes') as MockDirHandle;
    expect(notes).toBeDefined();
    expect(notes.children.has('Deep Note.md')).toBe(true);
  });

  it('initNoteFileSync is idempotent', () => {
    const sync = getNoteFileSync();
    sync.initNoteFileSync();
    sync.initNoteFileSync();
    expect(hasListeners('note:saved')).toBe(true);
  });

  it('verifyPermission returns true only when granted', async () => {
    const granted = new MockDirHandle('g', null, 'granted');
    const denied = new MockDirHandle('d', null, 'denied');
    const promptGranted = new MockDirHandle('p', null, 'prompt');
    promptGranted.requestPermission = () => Promise.resolve('granted');

    await expect(verifyPermission(granted as unknown as FileSystemDirectoryHandle)).resolves.toBe(true);
    await expect(verifyPermission(denied as unknown as FileSystemDirectoryHandle)).resolves.toBe(false);
    await expect(verifyPermission(promptGranted as unknown as FileSystemDirectoryHandle)).resolves.toBe(true);
  });
});
