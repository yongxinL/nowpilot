import { stringify, parse } from 'yaml';
import { getDB } from '../storage/IndexedDBManager';
import { debugLog } from '../utils/debugLog';
import { normalizeCategoryPath, type Note } from './LinkParser';
import { notesDB } from '../storage/stores/NotesDB';

// ── Types ──

export interface SyncResult {
  success: boolean;
  conflict?: boolean;
}

export interface ImportPreview {
  total: number;
  new: number;
  updated: number;
  unchanged: number;
}

interface PendingSync {
  timer: ReturnType<typeof setTimeout>;
  resolve: (value: SyncResult) => void;
  reject: (reason: unknown) => void;
}

// ── Helper: extract title from first # heading ──

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

// ── Helper: format note as .md with YAML frontmatter ──

export function formatNoteAsMarkdown(note: Note): string {
  const frontmatter: Record<string, unknown> = {
    id: note.id,
    created: note.created,
    updated: note.updated,
    tags: note.tags,
  };
  if (note.categoryPath) frontmatter.categoryPath = note.categoryPath;
  if (note.summary) frontmatter.summary = note.summary;

  const yamlStr = stringify(frontmatter, { lineWidth: 0, indent: 2 });
  return `---\n${yamlStr}---\n\n${note.content}`;
}

// ── Helper: parse .md with YAML frontmatter back to partial Note ──

export function parseNoteFromMarkdown(md: string, categoryPath?: string): Partial<Note> {
  const frontmatterMatch = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) return { content: md, categoryPath };

  const frontmatterYaml = frontmatterMatch[1];
  const body = md.slice(frontmatterMatch[0].length);
  const metadata = parse(frontmatterYaml) as Record<string, unknown>;

  return {
    id: metadata.id as string,
    title: extractTitle(body),
    content: body,
    created: metadata.created as number,
    updated: metadata.updated as number,
    tags: (metadata.tags as string[]) || [],
    categoryPath: (metadata.categoryPath as string) || categoryPath || undefined,
    summary: metadata.summary as string | undefined,
  };
}

// ── NoteFileSync class ──

export class NoteFileSync {
  private pendingSyncs = new Map<string, PendingSync>();

  /**
   * Open a folder picker and persist the handle to IndexedDB.
   * Returns null if the user cancels the picker.
   */
  async setBackupFolder(): Promise<{ folderName: string } | null> {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      const db = await getDB();
      await db.put('notes_backup_config', {
        id: 'primary' as const,
        folderHandle: handle,
        folderName: handle.name,
      });
      return { folderName: handle.name };
    } catch (err) {
      // User cancelled the dialog or an error occurred
      return null;
    }
  }

  /**
   * Retrieve the persisted backup folder handle with permission verification.
   */
  async getBackupHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await getDB();
      const config = await db.get('notes_backup_config', 'primary');
      if (!config) return null;

      const permission = await config.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission === 'granted') return config.folderHandle;
      if (permission === 'prompt') {
        const result = await config.folderHandle.requestPermission({ mode: 'readwrite' });
        if (result === 'granted') return config.folderHandle;
      }
      return null;
    } catch (err) {
      debugLog('error', '[NoteFileSync] getBackupHandle failed', { error: err });
      return null;
    }
  }

  /**
   * Return the current backup status: 'on', 'off', or 'error'.
   */
  async getBackupStatus(): Promise<{ status: 'on' | 'off' | 'error'; folderName?: string; error?: string }> {
    try {
      const db = await getDB();
      const config = await db.get('notes_backup_config', 'primary');
      if (!config) return { status: 'off' };

      const permission = await config.folderHandle.queryPermission({ mode: 'readwrite' });
      if (permission === 'denied') return { status: 'error', error: 'Permission revoked' };
      if (permission === 'granted') return { status: 'on', folderName: config.folderName };

      // 'prompt' — try to request permission
      const result = await config.folderHandle.requestPermission({ mode: 'readwrite' });
      if (result === 'granted') return { status: 'on', folderName: config.folderName };
      return { status: 'error', error: 'Permission denied' };
    } catch (err) {
      debugLog('error', '[NoteFileSync] getBackupStatus failed', { error: err });
      return { status: 'error', error: 'Failed to check permission' };
    }
  }

  /**
   * Sync a note to the filesystem with 50ms debounce.
   * Fire-and-forget per D-09. Returns a promise that resolves
   * when the debounced write completes (trailing edge).
   *
   * If no backup folder is set, returns { success: false } immediately (no-op).
   */
  async sync(note: Note, action: 'create' | 'update' | 'delete'): Promise<SyncResult> {
    try {
      const handle = await this.getBackupHandle();
      if (!handle) return { success: false };

      // Debounce: cancel previous pending sync for this note
      const existing = this.pendingSyncs.get(note.id);
      if (existing) {
        clearTimeout(existing.timer);
        existing.resolve({ success: false });
      }

      return new Promise<SyncResult>((resolve, reject) => {
        const timer = setTimeout(async () => {
          this.pendingSyncs.delete(note.id);
          try {
            const result = await this.executeWrite(handle, note, action);
            resolve(result);
          } catch (err) {
            debugLog('error', '[NoteFileSync] sync write failed', { error: err, noteId: note.id });
            resolve({ success: false });
          }
        }, 50);
        this.pendingSyncs.set(note.id, { timer, resolve, reject });
      });
    } catch (err) {
      debugLog('error', '[NoteFileSync] sync failed', { error: err });
      return { success: false };
    }
  }

  /**
   * Perform the actual file write / delete operation.
   */
  private async executeWrite(
    handle: FileSystemDirectoryHandle,
    note: Note,
    action: 'create' | 'update' | 'delete',
  ): Promise<SyncResult> {
    try {
      // Resolve directory path
      let dirHandle = handle;
      if (note.categoryPath) {
        const normalized = normalizeCategoryPath(note.categoryPath);
        if (typeof normalized === 'string') {
          const segments = normalized.split('/');
          for (const segment of segments) {
            dirHandle = await dirHandle.getDirectoryHandle(segment, { create: true });
          }
        }
      }

      // Sanitize filename
      const safeTitle = note.title.replace(/[\/\\:*?"<>|]/g, '_');
      const fileName = `${safeTitle}.md`;

      // ── DELETE action ──
      if (action === 'delete') {
        try {
          await dirHandle.removeEntry(fileName);
          // Prune empty category folders (deepest first)
          await this.pruneEmptyFolders(handle, note.categoryPath);
        } catch {
          // File may not exist, no-op
        }
        await this.updateLastSyncTimestamp();
        return { success: true };
      }

      // ── CREATE action — resolve collision ──
      let finalName = fileName;
      if (action === 'create') {
        try {
          await dirHandle.getFileHandle(finalName);
          // File exists — find next available name
          let counter = 1;
          while (true) {
            finalName = `${safeTitle} (${counter}).md`;
            try {
              await dirHandle.getFileHandle(finalName);
              counter++;
            } catch {
              break; // Found an available name
            }
          }
        } catch {
          // File doesn't exist yet — use original name
        }
      }

      // ── UPDATE action — check external change ──
      if (action === 'update') {
        try {
          const existingHandle = await dirHandle.getFileHandle(finalName);
          const file = await existingHandle.getFile();
          if (file.lastModified > note.updated + 2000) {
            return { success: false, conflict: true };
          }
        } catch {
          // File doesn't exist yet — treat as create-like
        }
      }

      // ── Write the file ──
      const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(formatNoteAsMarkdown(note));
      await writable.close();

      await this.updateLastSyncTimestamp();
      return { success: true };
    } catch (err) {
      debugLog('error', '[NoteFileSync] executeWrite failed', { error: err, noteId: note.id });
      return { success: false };
    }
  }

  /**
   * Remove empty category folders after a delete, walking from deepest to shallowest.
   */
  private async pruneEmptyFolders(
    rootHandle: FileSystemDirectoryHandle,
    categoryPath?: string,
  ): Promise<void> {
    if (!categoryPath) return;
    const segments = categoryPath.split('/');

    for (let i = segments.length; i >= 1; i--) {
      const currentName = segments[i - 1];
      const parentPathSegments = segments.slice(0, i - 1);

      try {
        let parentHandle = rootHandle;
        for (const seg of parentPathSegments) {
          parentHandle = await parentHandle.getDirectoryHandle(seg);
        }

        const dirToCheck = await parentHandle.getDirectoryHandle(currentName);
        // Check if directory is empty (has no entries)
        let empty = true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of (dirToCheck as any).values()) {
          empty = false;
          break;
        }
        if (empty) {
          await parentHandle.removeEntry(currentName);
        } else {
          return; // Not empty — stop pruning
        }
      } catch {
        return;
      }
    }
  }

  /**
   * Update the lastSyncTimestamp in the backup config after a write.
   */
  private async updateLastSyncTimestamp(): Promise<void> {
    try {
      const db = await getDB();
      const config = await db.get('notes_backup_config', 'primary');
      if (config) {
        await db.put('notes_backup_config', {
          ...config,
          lastSyncTimestamp: Date.now(),
        });
      }
    } catch (err) {
      debugLog('error', '[NoteFileSync] updateLastSyncTimestamp failed', { error: err });
    }
  }

  /**
   * Open a folder picker, walk the directory tree, parse all .md files,
   * and return a preview of what would be imported.
   */
  async importFromFolder(): Promise<{ preview: ImportPreview; notes: Array<Partial<Note>> } | null> {
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch {
      return null;
    }

    try {
      const result: Array<{ note: Partial<Note>; filePath: string }> = [];
      await this.walkDirectory(handle, '', result);

      const allDbNotes = await notesDB.getAllNotes();

      let newCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;

      for (const { note } of result) {
        if (!note.id) {
          newCount++;
          continue;
        }
        const existing = allDbNotes.find((n) => n.id === note.id);
        if (!existing) {
          newCount++;
          continue;
        }
        if (note.updated !== undefined && existing.updated !== undefined && note.updated <= existing.updated) {
          unchangedCount++;
        } else {
          updatedCount++;
        }
      }

      return {
        preview: {
          total: result.length,
          new: newCount,
          updated: updatedCount,
          unchanged: unchangedCount,
        },
        notes: result.map((r) => r.note),
      };
    } catch (err) {
      debugLog('error', '[NoteFileSync] importFromFolder failed', { error: err });
      return null;
    }
  }

  /**
   * Recursively walk a directory and collect parsed .md files.
   */
  private async walkDirectory(
    handle: FileSystemDirectoryHandle,
    parentPath: string,
    result: Array<{ note: Partial<Note>; filePath: string }>,
  ): Promise<void> {
    try {
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'directory') {
          const subPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
          await this.walkDirectory(entry as FileSystemDirectoryHandle, subPath, result);
        } else if (entry.kind === 'file' && (entry.name as string).endsWith('.md')) {
          try {
            const fileHandle = await (handle as any).getFileHandle(entry.name);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const parsed = parseNoteFromMarkdown(text, parentPath || undefined);
            result.push({
              note: parsed,
              filePath: parentPath ? `${parentPath}/${entry.name}` : entry.name,
            });
          } catch (fileErr) {
            debugLog('warn', '[NoteFileSync] failed to read file', {
              file: entry.name,
              error: fileErr,
            });
          }
        }
      }
    } catch (err) {
      debugLog('error', '[NoteFileSync] walkDirectory failed', { error: err, path: parentPath });
    }
  }

  /**
   * Upsert parsed notes into IndexedDB and return all notes for index rebuild.
   */
  async executeImport(notes: Array<Partial<Note>>): Promise<{ count: number; allNotes: Note[] }> {
    try {
      let count = 0;
      for (const note of notes) {
        if (!note.id) continue;
        const existing = await notesDB.getNote(note.id);
        if (existing) {
          await notesDB.updateNote({
            ...existing,
            ...note,
            updated: Date.now(),
          } as Note);
        } else {
          await notesDB.createNote({
            id: note.id,
            title: note.title || 'Untitled',
            content: note.content || '',
            created: note.created || Date.now(),
            updated: Date.now(),
            tags: note.tags || [],
            ...(note.summary ? { summary: note.summary } : {}),
            ...(note.categoryPath ? { categoryPath: note.categoryPath } : {}),
          } as Note);
        }
        count++;
      }

      const allNotes = await notesDB.getAllNotes();
      return { count, allNotes };
    } catch (err) {
      debugLog('error', '[NoteFileSync] executeImport failed', { error: err });
      return { count: 0, allNotes: [] };
    }
  }
}

export const noteFileSync = new NoteFileSync();
