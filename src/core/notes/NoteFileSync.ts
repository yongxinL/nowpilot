/**
 * NoteFileSync.ts — One-way app→filesystem .md backup (SYNC-01…11,
 * OKF-WIKI-01…04, WIKI-ID-01, CAT-04, D-119/120/121).
 *
 * Per-save sync: serialize Note → OKF v0.2 YAML frontmatter + markdown
 * body → write to {categoryPath}/{title}.md. Restore: walk backup tree →
 * parse .md → upsert notes (additive, preserves UUID identity + wikilinks).
 *
 * D-06: NO background jobs — the subscription is in-process (UI context).
 * FS operations abstracted behind FileSystemAdapter for testability.
 */

import type { IDBPDatabase } from 'idb';
import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import { on } from '../events/EventBus';
import { NOTE_SAVED_EVENT, type NoteSavedPayload } from './save';
import type { Note, OkfFrontmatter } from '../../types/notes';
import type { NotesDBV1 } from '../storage/NotesDB';
import { debugLog } from '../log/debugLog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a sync operation. */
export interface SyncResult {
  status: 'written' | 'skipped' | 'conflict' | 'no-folder' | 'deleted';
  path?: string;
}

/** Restore preview counts (SYNC-10, UI-SPEC data contract). */
export interface RestorePreview {
  total: number;
  new: number;
  updated: number;
  unchanged: number;
  conflicts: Array<{ noteId: string; title: string; resolution: 'create' | 'update' }>;
}

/**
 * FS abstraction for testing. Production impl uses real File System Access
 * API. Tests inject a mock impl backed by an in-memory filesystem.
 */
export interface FileSystemAdapter {
  getRoot(): FileSystemDirectoryHandle | null;
  ensureDirectory(path: string): Promise<FileSystemDirectoryHandle>;
  getFileHandle(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle | null>;
  createFileHandle(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle>;
  writeFile(handle: FileSystemFileHandle, contents: string): Promise<void>;
  deleteFile(dir: FileSystemDirectoryHandle, name: string): Promise<void>;
  listEntries(dir: FileSystemDirectoryHandle): Promise<Array<{ name: string; kind: 'file' | 'directory' }>>;
  readFile(handle: FileSystemFileHandle): Promise<string>;
  getLastModified(handle: FileSystemFileHandle): Promise<number>;
  removeDirectoryIfEmpty(dir: FileSystemDirectoryHandle): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Serialization (SYNC-04, OKF-WIKI-01/02/03)
// ---------------------------------------------------------------------------

/**
 * Serialize a note to OKF v0.2 markdown: YAML frontmatter + body.
 *
 * OKF-WIKI-04 boundary: wikilinks ([[Title]]) stay inline in the body.
 * No OKF standard-markdown-link edges are emitted.
 */
export function serializeNoteToMarkdown(note: Note, tier: string): string {
  const frontmatter: OkfFrontmatter = {
    type: note.type ?? 'Note',
    title: note.title,
    description: note.summary,
    id: note.id,
    created: note.created,
    updated: note.updated,
    tags: note.tags,
    categoryPath: note.categoryPath,
    generated: { by: `nowpilot/${tier}`, at: new Date().toISOString() },
    status: 'stable',
  };

  const yamlBlock = yamlStringify(frontmatter);
  return `---\n${yamlBlock}---\n\n${note.content}`;
}

/**
 * Parse OKF markdown into frontmatter + body.
 *
 * Tolerates unknown OKF fields (D-121): extra keys in the YAML are
 * preserved in the parsed object but don't break parsing.
 */
export function parseNoteFromMarkdown(md: string): { frontmatter: OkfFrontmatter; body: string } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid OKF markdown format: missing frontmatter delimiters');
  }

  const yamlBlock = match[1];
  const body = match[2];
  const raw = yamlParse(yamlBlock) as OkfFrontmatter;

  return { frontmatter: raw, body };
}

// ---------------------------------------------------------------------------
// File path (SYNC-04, CAT-04)
// ---------------------------------------------------------------------------

/** Replace filesystem-illegal characters with underscore. */
export function sanitizeFilename(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, '_');
}

/** Build the backup file path: {categoryPath}/{sanitizedTitle}.md */
export function buildFilePath(note: Note): string {
  const filename = `${sanitizeFilename(note.title)}.md`;
  return note.categoryPath ? `${note.categoryPath}/${filename}` : filename;
}

// ---------------------------------------------------------------------------
// Handle persistence (SYNC-01, D-08)
// ---------------------------------------------------------------------------

const BACKUP_HANDLE_KEY = 'backup_handle';

/** Read the backup handle from notes_backup_config store. */
export async function getBackupHandle(
  db: IDBPDatabase<NotesDBV1>,
): Promise<FileSystemDirectoryHandle | null> {
  const config = await db.get('notes_backup_config', BACKUP_HANDLE_KEY);
  if (!config) return null;

  const handle = config.handle as FileSystemDirectoryHandle;
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    debugLog('NOTE_FILE_SYNC_PERMISSION_DENIED', 'Backup handle permission not granted');
    return null;
  }

  return handle;
}

/** Persist the backup handle to notes_backup_config store. */
export async function persistBackupHandle(
  db: IDBPDatabase<NotesDBV1>,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await db.put('notes_backup_config', { key: BACKUP_HANDLE_KEY, handle });
}

// ---------------------------------------------------------------------------
// Sync engine (SYNC-03/05/06/07/11, CAT-04)
// ---------------------------------------------------------------------------

/** Split a file path into directory path and filename. */
function splitFilePath(filePath: string): { dirPath: string; filename: string } {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash < 0) {
    return { dirPath: '', filename: filePath };
  }
  return {
    dirPath: filePath.slice(0, lastSlash),
    filename: filePath.slice(lastSlash + 1),
  };
}

/**
 * Resolve a unique filename by appending (n) suffix on collision.
 * e.g. "My Note.md" → "My Note (1).md" → "My Note (2).md"
 */
async function resolveUniqueFilename(
  adapter: FileSystemAdapter,
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<string> {
  const existing = await adapter.getFileHandle(dir, filename);
  if (!existing) return filename;

  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex >= 0 ? filename.slice(dotIndex) : '';

  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${base} (${counter})${ext}`;
    const exists = await adapter.getFileHandle(dir, candidate);
    if (!exists) return candidate;
    counter++;
  }
}

/**
 * Sync a single note to the filesystem.
 *
 * @param db — opened NotesDB instance.
 * @param adapter — filesystem adapter.
 * @param note — the note to sync.
 * @param tier — AI tier label (for generated.by field).
 * @param now — current timestamp (for external-change guard). Defaults to Date.now().
 */
export async function syncNoteToFilesystem(
  db: IDBPDatabase<NotesDBV1>,
  adapter: FileSystemAdapter,
  note: Note,
  tier: string,
  now: number = Date.now(),
): Promise<SyncResult> {
  const root = adapter.getRoot();
  if (!root) {
    return { status: 'no-folder' };
  }

  const filePath = buildFilePath(note);
  const { dirPath, filename } = splitFilePath(filePath);

  // Ensure target directory exists.
  const dir = await adapter.ensureDirectory(dirPath);

  // Check for existing file (collision + external-change guard).
  const existingHandle = await adapter.getFileHandle(dir, filename);
  if (existingHandle) {
    const lastModified = await adapter.getLastModified(existingHandle);
    // External-change guard: file modified after our sync window (2s tolerance).
    if (lastModified > now + 2000) {
      debugLog('NOTE_FILE_SYNC_CONFLICT', 'File modified externally — skipping', {
        noteId: note.id,
        path: filePath,
        lastModified,
        now,
      });
      return { status: 'conflict', path: filePath };
    }
  }

  // Resolve unique filename (collision handling).
  const uniqueFilename = await resolveUniqueFilename(adapter, dir, filename);

  // Create file and write.
  const handle = await adapter.createFileHandle(dir, uniqueFilename);
  const content = serializeNoteToMarkdown(note, tier);
  await adapter.writeFile(handle, content);

  const writtenPath = dirPath ? `${dirPath}/${uniqueFilename}` : uniqueFilename;
  return { status: 'written', path: writtenPath };
}

/**
 * Delete a note's .md file from the filesystem (SYNC-11).
 * If the category folder becomes empty, removes it too.
 */
export async function deleteFromSync(
  adapter: FileSystemAdapter,
  note: Note,
  filename: string,
): Promise<void> {
  const root = adapter.getRoot();
  if (!root) return;

  const filePath = buildFilePath(note);
  const { dirPath } = splitFilePath(filePath);
  const dir = await adapter.ensureDirectory(dirPath);

  await adapter.deleteFile(dir, filename);

  // Remove empty category folder (SYNC-11).
  if (dirPath) {
    const isEmpty = await adapter.removeDirectoryIfEmpty(dir);
    if (isEmpty) {
      debugLog('NOTE_FILE_SYNC_FOLDER_REMOVED', 'Removed empty category folder', { dirPath });
    }
  }
}

// ---------------------------------------------------------------------------
// Restore parser (SYNC-09/10, D-121, WIKI-ID-01/04)
// ---------------------------------------------------------------------------

/**
 * Walk the backup tree and build a restore preview.
 *
 * For each .md file: parse frontmatter, check if note exists in DB,
 * classify as new/updated/unchanged.
 */
export async function restoreFromBackup(
  db: IDBPDatabase<NotesDBV1>,
  adapter: FileSystemAdapter,
): Promise<RestorePreview> {
  const root = adapter.getRoot();
  if (!root) {
    return { total: 0, new: 0, updated: 0, unchanged: 0, conflicts: [] };
  }

  const preview: RestorePreview = {
    total: 0,
    new: 0,
    updated: 0,
    unchanged: 0,
    conflicts: [],
  };

  await walkDirectory(db, adapter, root, '', preview);
  return preview;
}

/** Recursively walk a directory, parsing .md files. */
async function walkDirectory(
  db: IDBPDatabase<NotesDBV1>,
  adapter: FileSystemAdapter,
  dir: FileSystemDirectoryHandle,
  relativePath: string,
  preview: RestorePreview,
): Promise<void> {
  const entries = await adapter.listEntries(dir);

  for (const entry of entries) {
    if (entry.kind === 'directory') {
      const childPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const childDir = await adapter.ensureDirectory(childPath);
      await walkDirectory(db, adapter, childDir, childPath, preview);
      continue;
    }

    if (!entry.name.endsWith('.md')) continue;

    preview.total++;

    const handle = await adapter.getFileHandle(dir, entry.name);
    if (!handle) continue;

    const content = await adapter.readFile(handle);
    let frontmatter: OkfFrontmatter;
    try {
      const parsed = parseNoteFromMarkdown(content);
      frontmatter = parsed.frontmatter;
    } catch {
      // Malformed .md — skip (D-121 tolerance).
      debugLog('NOTE_FILE_SYNC_PARSE_SKIPPED', 'Skipping malformed .md during restore', {
        path: relativePath ? `${relativePath}/${entry.name}` : entry.name,
      });
      continue;
    }

    // Check if note exists in DB (by UUID id — WIKI-ID-01).
    const existingNote = await db.get('notes', frontmatter.id);

    if (existingNote) {
      // Note exists — classify as updated or unchanged.
      if (existingNote.updated < frontmatter.updated) {
        preview.updated++;
        preview.conflicts.push({
          noteId: frontmatter.id,
          title: frontmatter.title,
          resolution: 'update',
        });
      } else {
        preview.unchanged++;
      }
    } else {
      // Note missing — classify as new.
      preview.new++;
      preview.conflicts.push({
        noteId: frontmatter.id,
        title: frontmatter.title,
        resolution: 'create',
      });
    }
  }
}

/**
 * Execute the restore: upsert each parsed note into NotesDB.
 * Additive — notes not in the folder are NOT deleted (SYNC-09).
 */
export async function importFromBackup(
  db: IDBPDatabase<NotesDBV1>,
  adapter: FileSystemAdapter,
): Promise<void> {
  const root = adapter.getRoot();
  if (!root) return;

  await walkAndImport(db, adapter, root, '');
}

/** Recursively walk and import .md files. */
async function walkAndImport(
  db: IDBPDatabase<NotesDBV1>,
  adapter: FileSystemAdapter,
  dir: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<void> {
  const entries = await adapter.listEntries(dir);

  for (const entry of entries) {
    if (entry.kind === 'directory') {
      const childPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const childDir = await adapter.ensureDirectory(childPath);
      await walkAndImport(db, adapter, childDir, childPath);
      continue;
    }

    if (!entry.name.endsWith('.md')) continue;

    const handle = await adapter.getFileHandle(dir, entry.name);
    if (!handle) continue;

    const content = await adapter.readFile(handle);
    let frontmatter: OkfFrontmatter;
    let body: string;
    try {
      const parsed = parseNoteFromMarkdown(content);
      frontmatter = parsed.frontmatter;
      body = parsed.body;
    } catch {
      continue; // skip malformed
    }

    // categoryPath reconstructed from folder path (SYNC-09).
    const categoryPath = relativePath || undefined;

    // Check if note exists (by UUID id — WIKI-ID-01).
    const existingNote = await db.get('notes', frontmatter.id);

    if (existingNote) {
      // Update existing note (preserve identity).
      const updated: Note = {
        ...existingNote,
        title: frontmatter.title,
        content: body,
        tags: frontmatter.tags ?? existingNote.tags,
        categoryPath: categoryPath ?? existingNote.categoryPath,
        updated: frontmatter.updated,
        type: frontmatter.type,
        summary: frontmatter.description,
      };
      await db.put('notes', updated);
    } else {
      // Create new note (preserve UUID identity from frontmatter).
      const created: Note = {
        id: frontmatter.id,
        title: frontmatter.title,
        content: body,
        created: frontmatter.created,
        updated: frontmatter.updated,
        tags: frontmatter.tags ?? [],
        links: [],
        unresolvedLinks: [],
        source: { kind: 'manual' },
        aiMeta: { suggestedLinks: [], concepts: [] },
        categoryPath,
        type: frontmatter.type,
        summary: frontmatter.description,
        version: 1,
      };
      await db.put('notes', created);
    }
  }
}

// ---------------------------------------------------------------------------
// Event subscription (SYNC-03, D-119)
// ---------------------------------------------------------------------------

/**
 * Subscribe to NOTE_SAVED_EVENT. 50ms debounce before syncing.
 * Fire-and-forget: no loading state, errors caught + debugLogged.
 *
 * @param db — opened NotesDB instance.
 * @param adapter — filesystem adapter.
 * @param tier — AI tier label.
 * @returns Unsubscribe function.
 */
export function init(
  db: IDBPDatabase<NotesDBV1>,
  adapter: FileSystemAdapter,
  tier: string,
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return on(NOTE_SAVED_EVENT, (payload) => {
    const { noteId } = payload as NoteSavedPayload;

    // Clear pending debounce timer.
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 50ms debounce before syncing.
    debounceTimer = setTimeout(() => {
      void (async () => {
        try {
          const note = await db.get('notes', noteId);
          if (!note) {
            debugLog('NOTE_FILE_SYNC_NOTE_MISSING', 'Note not found for sync', { noteId });
            return;
          }
          await syncNoteToFilesystem(db, adapter, note, tier);
        } catch (err) {
          debugLog('NOTE_FILE_SYNC_FAILED', 'Sync failed', {
            noteId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }, 50);
  });
}
