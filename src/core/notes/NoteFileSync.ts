/// <reference types="wicg-file-system-access" />
import { openDB, type IDBPDatabase } from 'idb';
import { stringify, parse } from 'yaml';
import { on, emit } from '../events/EventBus';
import { migrationRunner } from '../storage/MigrationRunner';
import { getNotesDb } from './NotesDB';
import type { Note } from './NoteSchema';

// ── Module-level constants ───────────────────────────────────────────────────
/** Debounce window for coalescing rapid note saves (SYNC-03, D-17). */
export const DEBOUNCE_MS = 50;
/** Tolerance when comparing file.lastModified vs note.lastSyncedAt (D-11). */
export const EXTERNAL_CHANGE_TOLERANCE_MS = 2000;
/** Characters illegal in filenames on Windows/macOS/Linux — replaced (SYNC-04). */
export const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
/** IndexedDB key of the single backup_config record (D-09). */
export const BACKUP_CONFIG_KEY = 'backup_folder';

// ── Public event payload types ───────────────────────────────────────────────
export type SyncErrorReason = 'permission_denied' | 'handle_expired' | 'not_allowed' | 'error';

export interface SyncErrorEvent {
  noteId?: string;
  error: string;
  reason: SyncErrorReason;
}

export interface ExternalChangeEvent {
  noteId: string;
  title: string;
  localModified: number;
  fileModified: number;
}

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface SyncStatus {
  enabled: boolean;
  handleExists: boolean;
  permissionState: PermissionState;
  lastSyncAt?: number;
  error?: string;
}

export interface RestorePreview {
  total: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
}

export interface RestoreNoteAction {
  noteId: string;
  title: string;
  action: 'new' | 'updated' | 'unchanged';
}

export interface RestoreResult {
  preview: RestorePreview;
  notes: RestoreNoteAction[];
}

// ── Frontmatter shape written to .md files ───────────────────────────────────
export interface NoteFrontmatter {
  id: string;
  title: string;
  created: number;
  updated: number;
  tags: string[];
  categoryPath: string | null;
  summary: string | null;
}

// ── Pure helpers (exported for testing) ──────────────────────────────────────

/** SYNC-04: replace invalid filename chars with `_`, trim, fall back to 'untitled'. */
export function sanitizeFilename(title: string): string {
  const sanitized = title.replace(INVALID_FILENAME_CHARS, '_').trim();
  return sanitized || 'untitled';
}

/** SYNC-05 file path format: `{categoryPath}/{sanitizedTitle}.md` (or `{sanitizedTitle}.md` at root). */
export function buildFilePath(categoryPath: string, title: string): string {
  const sanitized = sanitizeFilename(title);
  return categoryPath ? `${categoryPath}/${sanitized}.md` : `${sanitized}.md`;
}

/** SYNC-04: YAML frontmatter + markdown body with `---` delimiters. */
export function buildNoteFile(note: Note): string {
  const fm: NoteFrontmatter = {
    id: note.id,
    title: note.title,
    created: note.createdAt,
    updated: note.updatedAt,
    tags: note.tags,
    categoryPath: note.categoryPath || null,
    summary: note.summary ?? null,
  };
  const yamlBody = stringify(fm, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE' });
  return `---\n${yamlBody}---\n\n${note.content}`;
}

/**
 * Parse a .md file with YAML frontmatter. Throws when no frontmatter block
 * exists (callers skip malformed files instead of crashing the restore loop).
 */
export function parseNoteFile(content: string): { frontmatter: NoteFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) throw new Error('No YAML frontmatter found');
  const fm = parse(match[1]) as NoteFrontmatter;
  return { frontmatter: fm, body: match[2] };
}

/**
 * D-10 permission check: query first, requestPermission as fallback (user
 * gesture required for the fallback). Returns true only on 'granted'.
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  readWrite = true,
): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = {};
  if (readWrite) options.mode = 'readwrite';
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * NoteFileSync — one-way app→filesystem .md backup (SYNC-01..11, NOTE-03).
 *
 * Subscribes to `note:saved` independently from NoteTagger (D-17) and writes
 * Obsidian-compatible `.md` files (YAML frontmatter + markdown body) to a
 * user-selected directory after a 50ms debounce. The
 * FileSystemDirectoryHandle is persisted in the IndexedDB `backup_config`
 * store (D-09) and permission is re-verified before EVERY sync attempt
 * (D-10). Safety guards: external-change detection via lastModified vs
 * lastSyncedAt + 2s tolerance (D-11), numeric collision suffixing, rename /
 * delete cleanup (D-12), and additive-upsert-only folder restore.
 */
export class NoteFileSync {
  private _handle: FileSystemDirectoryHandle | null = null;
  private _syncEnabled = false;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastSyncAt: number | undefined;
  private _error: string | undefined;
  private _lastPermissionState: PermissionState = 'unknown';

  /**
   * Pick a backup folder (requires a user gesture). Persists the handle
   * in backup_config (D-09) and enables sync when permission is granted.
   */
  async setBackupFolder(): Promise<{ success: boolean; error?: string }> {
    try {
      if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
        return { success: false, error: 'File System Access API not available' };
      }
      const handle = await window.showDirectoryPicker();
      const granted = await verifyPermission(handle);
      if (!granted) {
        this._syncEnabled = false;
        this._lastPermissionState = 'denied';
        this._error = 'Permission denied';
        return { success: false, error: 'Permission denied' };
      }
      await this.persistHandle(handle);
      this._handle = handle;
      this._syncEnabled = true;
      this._lastPermissionState = 'granted';
      this._error = undefined;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._lastPermissionState = 'denied';
      return { success: false, error: message };
    }
  }

  /** D-10: current readwrite permission. 'denied' disables sync. */
  async checkPermission(): Promise<boolean> {
    if (!this._handle) return false;
    const options: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
    const state = await this._handle.queryPermission(options);
    this._lastPermissionState = state;
    if (state === 'granted') return true;
    if (state === 'denied') {
      this._syncEnabled = false;
      return false;
    }
    // 'prompt' — requestPermission needs a user gesture; may reject in
    // non-gesture contexts. Treat failure as not-granted.
    const granted = await this._handle.requestPermission(options);
    this._lastPermissionState = granted;
    return granted === 'granted';
  }

  /**
   * D-09: persist the handle in the v5 backup_config store (finally-close
   * pattern). A NATIVE FileSystemDirectoryHandle (from showDirectoryPicker)
   * is stored directly — Chrome structured-clones platform handles into
   * IndexedDB, so the stored value round-trips as a live handle (CR-01).
   * Only non-native handles (test doubles, cross-runtime fallbacks) are
   * normalized to a plain-data snapshot, because their own enumerable
   * function properties would throw DataCloneError in structured clone.
   */
  async persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await this.openDb();
    try {
      const stored = isNativeHandle(handle) ? handle : await toPlainHandle(handle);
      await db.put('backup_config', {
        id: BACKUP_CONFIG_KEY,
        handle: stored,
      });
    } finally {
      db.close();
    }
  }

  /**
   * D-09: load the persisted handle (null when never configured).
   * Handles BOTH stored shapes: a plain-data snapshot (PlainDirHandle with
   * a `children` array) is rehydrated into a functional directory handle;
   * a live handle-like object (native handle or any other handle with
   * values/getDirectoryHandle/getFileHandle) is returned as-is — a real
   * handle must never be rehydrated (CR-01).
   */
  async loadPersistedHandle(): Promise<FileSystemDirectoryHandle | null> {
    const db = await this.openDb();
    try {
      const record = await db.get('backup_config', BACKUP_CONFIG_KEY);
      const raw = record?.handle ?? null;
      if (!raw) return null;
      if (Array.isArray((raw as PlainDirHandle).children)) {
        return rehydrateHandle(raw as PlainDirHandle);
      }
      if (isLiveHandle(raw)) {
        return raw as FileSystemDirectoryHandle;
      }
      return null;
    } finally {
      db.close();
    }
  }

  /**
   * Subscribe to `note:saved` (D-17). Idempotent. On init, a persisted
   * handle is loaded and permission verified — an expired handle
   * (Pitfall 1) disables sync and emits `sync:error` with
   * reason 'handle_expired' so the UI can prompt "Re-select backup folder".
   */
  initNoteFileSync(): void {
    if (unsub) return;
    void this.restoreSession();
    unsub = on<{ noteId: string; version?: number }>('note:saved', ({ noteId }) => {
      this.scheduleSync(noteId);
    });
  }

  /** Load the persisted handle + verify permission (init + recovery path). */
  private async restoreSession(): Promise<void> {
    try {
      const handle = await this.loadPersistedHandle();
      if (!handle) {
        this._syncEnabled = false;
        return;
      }
      this._handle = handle;
      if (!(await this.checkPermission())) {
        // D-10 / Pitfall 1: handle exists but permission is gone.
        this._syncEnabled = false;
        this._error = 'Backup folder permission expired — re-select folder';
        emit<SyncErrorEvent>('sync:error', {
          error: this._error,
          reason: 'handle_expired',
        });
      } else {
        // D-09: a restored handle with live readwrite permission resumes
        // syncing — the fresh singleton starts disabled, so restoreSession
        // must re-enable it or backup silently never resumes after restart.
        this._syncEnabled = true;
        this._error = undefined;
      }
    } catch (err) {
      this._syncEnabled = false;
      this._error = err instanceof Error ? err.message : String(err);
    }
  }

  /** 50ms debounce (SYNC-03): clears the pending timer, then fires once. */
  private scheduleSync(noteId: string): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      void this.syncNote(noteId);
    }, DEBOUNCE_MS);
  }

  /**
   * Fire-and-forget sync of one note. All file I/O errors are emitted as
   * `sync:error` events — this method never throws (EventBus contract).
   */
  async syncNote(noteId: string): Promise<void> {
    try {
      if (!this._syncEnabled || !this._handle) return;

      // D-10: permission verified before EVERY sync attempt.
      if (!(await this.checkPermission())) {
        this._syncEnabled = false;
        this._error = 'Permission denied';
        emit<SyncErrorEvent>('sync:error', {
          noteId,
          error: this._error,
          reason: 'permission_denied',
        });
        return;
      }

      const found = await getNotesDb().get(noteId);
      if (!found.success) return; // note deleted between event and fire
      const note = found.note;

      // D-11: external-change detection — file.lastModified vs lastSyncedAt
      // with a 2s tolerance. A newer external file is never overwritten;
      // the sync falls through to a D-12 collision write instead.
      const existing = await this.tryGetExistingFile(note);
      let externalChange = false;
      if (existing) {
        const lastSyncedAt = note.lastSyncedAt ?? 0;
        externalChange = existing.lastModified > lastSyncedAt + EXTERNAL_CHANGE_TOLERANCE_MS;
        if (externalChange) {
          emit<ExternalChangeEvent>('sync:external-change', {
            noteId: note.id,
            title: note.title,
            localModified: note.updatedAt,
            fileModified: existing.lastModified,
          });
        }
      }

      // D-12 / SYNC-05: when the canonical file exists and is owned by a
      // different (or externally-modified) file, resolve via numeric
      // suffixing instead of overwriting.
      const fileName = existing && externalChange ? await this.collideFileName(note) : `${sanitizeFilename(note.title)}.md`;

      await this.writeNoteFile(note, fileName);
      const now = Date.now();
      this._lastSyncAt = now;
      this._error = undefined;
      await getNotesDb().updateLastSyncedAt(noteId, now);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isNotAllowed = err instanceof DOMException && err.name === 'NotAllowedError';
      if (isNotAllowed) {
        // Pitfall 1: stale handle / revoked permission surfaced as write error.
        this._syncEnabled = false;
      }
      this._error = message;
      emit<SyncErrorEvent>('sync:error', {
        noteId,
        error: message,
        reason: isNotAllowed ? 'not_allowed' : 'error',
      });
    }
  }

  /** Existing file for the note's canonical path, or null when absent. */
  private async tryGetExistingFile(note: Note): Promise<File | null> {
    try {
      const parent = await this.resolveDir(buildFilePath(note.categoryPath, note.title), false, true);
      if (!parent) return null;
      const fileHandle = await parent.getFileHandle(`${sanitizeFilename(note.title)}.md`);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  /** Write the .md file at {categoryPath}/{fileName} (SYNC-04/05). */
  private async writeNoteFile(note: Note, fileName: string): Promise<void> {
    const content = buildNoteFile(note);
    // create:true → resolveDir never returns null here
    const dir = (await this.resolveDir(buildFilePath(note.categoryPath, note.title), true, true))!;
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  /**
   * D-12 / SYNC-05 collision resolution: `{title} 1.md`, `{title} 2.md`, …
   * Returns the first suffixed file name that does not already exist.
   */
  private async collideFileName(note: Note): Promise<string> {
    const stem = sanitizeFilename(note.title);
    // create:true → resolveDir never returns null here
    const dir = (await this.resolveDir(buildFilePath(note.categoryPath, note.title), true, true))!;
    let suffix = 1;
    for (;;) {
      const candidate = `${stem} ${suffix}.md`;
      try {
        await dir.getFileHandle(candidate);
        suffix++;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          return candidate;
        }
        throw err;
      }
    }
  }

  /**
   * Create the directory chain for a path, creating segments as needed.
   * `isFilePath`: when true the last segment is a file name and resolution
   * stops at its parent directory; when false every segment is a directory
   * (resolution returns the target directory itself). When `create` is
   * false, returns null if any segment is missing.
   */
  private async resolveDir(
    filePath: string,
    create: boolean,
    isFilePath = true,
  ): Promise<FileSystemDirectoryHandle | null> {
    let segments = filePath.split('/').filter(Boolean);
    if (isFilePath) {
      segments = segments.slice(0, -1); // drop the file name
    }
    let dir = this._handle!;
    for (const segment of segments) {
      try {
        dir = await dir.getDirectoryHandle(segment, { create });
      } catch (err) {
        if (!create && err instanceof DOMException && err.name === 'NotFoundError') {
          return null;
        }
        throw err;
      }
    }
    return dir;
  }

  /**
   * D-12 / SYNC-05 collision resolution: `{title}.md` first; on
   * NotFoundError retry with `{title} 1.md`, `{title} 2.md`, …
   */
  private async getFileHandleWithCollision(
    dir: FileSystemDirectoryHandle,
    baseName: string,
  ): Promise<FileSystemFileHandle> {
    const stem = baseName.replace(/\.md$/, '');
    let suffix = 0;
    for (;;) {
      const candidate = suffix === 0 ? `${stem}.md` : `${stem} ${suffix}.md`;
      try {
        return await dir.getFileHandle(candidate, { create: true });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'NotFoundError')) {
          throw err;
        }
        suffix++;
      }
    }
  }

  /**
   * D-12: after a note rename, delete the orphaned .md at the old path and
   * remove now-empty parent category folders (bottom-up, empty only).
   */
  async handleNoteRename(oldNoteId: string, oldFilePath: string): Promise<void> {
    try {
      await this.removeFileAndEmptyParents(oldFilePath);
    } catch (err) {
      this.emitCleanupError(oldNoteId, err);
    }
  }

  /**
   * D-12: on note deletion, delete the .md and remove empty parent
   * category folders (bottom-up, empty only — T-05a-12).
   */
  async handleNoteDelete(noteId: string, filePath: string): Promise<void> {
    try {
      await this.removeFileAndEmptyParents(filePath);
    } catch (err) {
      this.emitCleanupError(noteId, err);
    }
  }

  private async removeFileAndEmptyParents(filePath: string): Promise<void> {
    const segments = filePath.split('/').filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) return;

    const dir = await this.resolveDir(filePath, false, true);
    if (!dir) return; // file already gone — nothing to clean
    await dir.removeEntry(fileName);

    // Ascend: remove empty parent directories only (T-05a-12). The dir-path
    // resolution returns the target directory itself, so the entry must be
    // removed from the directory one level above (when one exists).
    let current = dir;
    const pathSegments = [...segments];
    while (pathSegments.length > 0) {
      const target = await this.resolveDir(pathSegments.join('/'), false, false);
      if (!target) break;
      const children: unknown[] = [];
      for await (const _entry of target.values()) {
        children.push(_entry);
      }
      if (children.length > 0) break;
      const entryName = pathSegments[pathSegments.length - 1];
      const parentSegments = pathSegments.slice(0, -1);
      const parent =
        parentSegments.length > 0
          ? await this.resolveDir(parentSegments.join('/'), false, false)
          : this._handle;
      if (!parent) break;
      await parent.removeEntry(entryName);
      current = target;
      pathSegments.pop();
    }
  }

  private emitCleanupError(noteId: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    emit<SyncErrorEvent>('sync:error', { noteId, error: message, reason: 'error' });
  }

  /**
   * Restore (SYNC-09/10): walk the user-selected folder, parse .md files,
   * additive upsert. Local notes NOT in the folder are never deleted.
   * Preview counts are computed in a first pass, then new/updated notes
   * are persisted in a second pass (skipped on empty selection).
   */
  async restoreFromFolder(): Promise<RestoreResult> {
    if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
      throw new Error('File System Access API not available');
    }
    const handle = await window.showDirectoryPicker();

    const parsed: Array<{ frontmatter: NoteFrontmatter; body: string }> = [];
    const seenIds = new Set<string>();
    let skippedCount = 0;

    for await (const entry of this.walkMdFiles(handle)) {
      try {
        const text = await (await entry.getFile()).text();
        const { frontmatter, body } = parseNoteFile(text);
        if (!frontmatter || typeof frontmatter.id !== 'string' || !isUuid(frontmatter.id)) {
          skippedCount++;
          continue;
        }
        if (!frontmatter.title || typeof frontmatter.title !== 'string') {
          skippedCount++;
          continue;
        }
        if (seenIds.has(frontmatter.id)) {
          // duplicate id across files — first wins
          skippedCount++;
          continue;
        }
        seenIds.add(frontmatter.id);
        parsed.push({ frontmatter, body });
      } catch {
        skippedCount++; // malformed .md — skip, keep walking
      }
    }

    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const notes: RestoreNoteAction[] = [];

    for (const { frontmatter, body } of parsed) {
      const existing = await getNotesDb().get(frontmatter.id);
      const existingNote = existing.success ? existing.note : null;
      const action: RestoreNoteAction['action'] = !existingNote
        ? 'new'
        : (frontmatter.updated ?? 0) > existingNote.updatedAt
          ? 'updated'
          : 'unchanged';
      notes.push({ noteId: frontmatter.id, title: frontmatter.title, action });

      if (action === 'new') {
        newCount++;
        await this.createRestoredNote(frontmatter, body);
      } else if (action === 'updated' && existingNote) {
        updatedCount++;
        await this.updateRestoredNote(existingNote, frontmatter, body);
      } else {
        unchangedCount++;
      }
    }

    const preview: RestorePreview = {
      total: parsed.length,
      newCount,
      updatedCount,
      unchangedCount,
      skippedCount,
    };
    return { preview, notes };
  }

  private async *walkMdFiles(
    dir: FileSystemDirectoryHandle,
  ): AsyncGenerator<FileSystemFileHandle> {
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        yield entry as FileSystemFileHandle;
      } else if (entry.kind === 'directory') {
        yield* this.walkMdFiles(entry as FileSystemDirectoryHandle);
      }
    }
  }

  /** Additive upsert: brand-new note from parsed .md content. */
  private async createRestoredNote(
    frontmatter: NoteFrontmatter,
    body: string,
  ): Promise<void> {
    const note: Note = {
      id: frontmatter.id,
      title: frontmatter.title,
      content: body,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      categoryPath: frontmatter.categoryPath ?? '',
      createdAt: typeof frontmatter.created === 'number' ? frontmatter.created : Date.now(),
      updatedAt: typeof frontmatter.updated === 'number' ? frontmatter.updated : Date.now(),
      version: 1,
      provenance: { source: 'import' },
      links: [],
      unresolvedLinks: [],
      summary: typeof frontmatter.summary === 'string' ? frontmatter.summary : undefined,
    };
    await getNotesDb().save(note);
  }

  /** Merge parsed content into an existing note — id/createdAt preserved. */
  private async updateRestoredNote(
    existing: Note,
    frontmatter: NoteFrontmatter,
    body: string,
  ): Promise<void> {
    const merged: Note = {
      ...existing,
      title: frontmatter.title,
      content: body,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : existing.tags,
      categoryPath: frontmatter.categoryPath ?? existing.categoryPath,
      updatedAt: typeof frontmatter.updated === 'number' ? frontmatter.updated : Date.now(),
      summary: typeof frontmatter.summary === 'string' ? frontmatter.summary : undefined,
    };
    await getNotesDb().save(merged);
  }

  /** Backup status for the Phase 7 UI (green/red/yellow state). */
  getSyncStatus(): SyncStatus {
    return {
      enabled: this._syncEnabled,
      handleExists: this._handle !== null,
      permissionState: this._lastPermissionState,
      lastSyncAt: this._lastSyncAt,
      error: this._error,
    };
  }

  /** Reset transient state (recovery + test isolation). */
  resetRuntimeState(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._syncEnabled = false;
    this._lastPermissionState = 'unknown';
    this._lastSyncAt = undefined;
    this._error = undefined;
  }

  private async openDb(): Promise<IDBPDatabase> {
    await migrationRunner.migrate('NotesDB', 5);
    return openDB('NotesDB', 5);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// ── Handle persistence: native branch + plain-data snapshot fallback ────────
// Chrome's native FileSystemDirectoryHandle is a platform object whose
// methods live on the prototype — the browser structured-clones it natively
// into IndexedDB and returns a LIVE handle on load, so persistHandle stores
// it directly (CR-01). Test doubles and cross-runtime fallbacks are
// duck-typed as non-native and normalized to plain data before persisting
// (own enumerable functions would throw DataCloneError), then rebuilt into
// functional handles on load.

/**
 * Duck-type predicate for a NATIVE FileSystemDirectoryHandle platform
 * object: it exposes `isSameEntry` and `Symbol.asyncIterator`, which the
 * class-based test doubles lack. Native handles are persisted directly via
 * structured clone; everything else takes the plain-data snapshot path.
 * Exported for tests — the native-branch round-trip test reuses this exact
 * predicate to emulate the browser's identity-preserving handle clone.
 */
export function isNativeHandle(handle: FileSystemDirectoryHandle): boolean {
  return (
    typeof handle.isSameEntry === 'function' &&
    typeof handle[Symbol.asyncIterator] === 'function'
  );
}

/** True when a stored value is a live handle-like object (not a snapshot). */
function isLiveHandle(value: unknown): boolean {
  const v = value as { values?: unknown; getDirectoryHandle?: unknown; getFileHandle?: unknown };
  return (
    typeof v.values === 'function' &&
    typeof v.getDirectoryHandle === 'function' &&
    typeof v.getFileHandle === 'function'
  );
}

interface PlainFileHandle {
  kind: 'file';
  name: string;
  lastModified: number;
  content: string;
}

interface PlainDirHandle {
  kind: 'directory';
  name: string;
  permissionState: PermissionState;
  children: Array<PlainFileHandle | PlainDirHandle>;
}

/** Deep-convert a directory handle tree into plain, cloneable data. */
async function toPlainHandle(handle: FileSystemDirectoryHandle): Promise<PlainDirHandle> {
  const children: Array<PlainFileHandle | PlainDirHandle> = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file') {
      children.push({
        kind: 'file',
        name: entry.name,
        lastModified: (entry as FileSystemFileHandle & { lastModified: number }).lastModified ?? 0,
        content: (entry as FileSystemFileHandle & { content: string }).content ?? '',
      });
    } else if (entry.kind === 'directory') {
      children.push(await toPlainHandle(entry as FileSystemDirectoryHandle));
    }
  }
  return {
    kind: 'directory',
    name: handle.name,
    permissionState: (handle as FileSystemDirectoryHandle & { permissionState?: PermissionState })
      .permissionState ?? 'prompt',
    children,
  };
}

/** Rebuild a functional directory handle from the persisted plain snapshot. */
function rehydrateHandle(plain: PlainDirHandle): FileSystemDirectoryHandle {
  const dir: FileSystemDirectoryHandle = {
    kind: 'directory',
    name: plain.name,
    queryPermission: async () => plain.permissionState,
    requestPermission: async () => plain.permissionState,
    isSameEntry: async () => false,
    getDirectoryHandle: async (segment: string, options?: { create?: boolean }) => {
      const child = plain.children.find(
        (c): c is PlainDirHandle => c.kind === 'directory' && c.name === segment,
      );
      if (child) return rehydrateHandle(child);
      if (options?.create) {
        const created: PlainDirHandle = {
          kind: 'directory',
          name: segment,
          permissionState: plain.permissionState,
          children: [],
        };
        plain.children.push(created);
        return rehydrateHandle(created);
      }
      throw new DOMException('Not found', 'NotFoundError');
    },
    getFileHandle: async (fileName: string, options?: { create?: boolean }) => {
      const child = plain.children.find(
        (c): c is PlainFileHandle => c.kind === 'file' && c.name === fileName,
      );
      if (child) return rehydrateFile(child);
      if (options?.create) {
        const created: PlainFileHandle = {
          kind: 'file',
          name: fileName,
          lastModified: Date.now(),
          content: '',
        };
        plain.children.push(created);
        return rehydrateFile(created);
      }
      throw new DOMException('Not found', 'NotFoundError');
    },
    removeEntry: async (entryName: string) => {
      const idx = plain.children.findIndex((c) => c.name === entryName);
      if (idx >= 0) plain.children.splice(idx, 1);
    },
    resolve: async () => null,
    values: async function* () {
      for (const c of plain.children) {
        yield c.kind === 'directory' ? rehydrateHandle(c) : rehydrateFile(c);
      }
    },
  } as unknown as FileSystemDirectoryHandle;

  // keep the plain node linked so create/remove mutations round-trip
  (dir as FileSystemDirectoryHandle & { __plain?: PlainDirHandle }).__plain = plain;
  return dir;
}

function rehydrateFile(plain: PlainFileHandle): FileSystemFileHandle {
  const file = {
    kind: 'file',
    name: plain.name,
    getFile: async () =>
      ({ lastModified: plain.lastModified, text: async () => plain.content }) as unknown as File,
    createWritable: async () => ({
      write: async (chunk: string) => {
        plain.content = chunk;
        plain.lastModified = Date.now();
      },
      close: async () => {},
    }),
    isSameEntry: async () => false,
  } as unknown as FileSystemFileHandle;

  (file as FileSystemFileHandle & { __plain?: PlainFileHandle }).__plain = plain;
  return file;
}

// ── Singleton (module-level, MemoryEngine pattern) ───────────────────────────
let _instance: NoteFileSync | null = null;
let unsub: (() => void) | null = null;

export function getNoteFileSync(): NoteFileSync {
  if (!_instance) {
    _instance = new NoteFileSync();
  }
  return _instance;
}

/** Test isolation: unsubscribe + drop the singleton. */
export function resetNoteFileSync(): void {
  if (unsub) {
    unsub();
    unsub = null;
  }
  if (_instance) {
    _instance.resetRuntimeState();
    _instance = null;
  }
}
