import { noteSearchIndex } from './notes/MiniSearchNoteIndex';
import { notesDb } from './notes/NotesDB';
import { setPrimarySurfaceId, publish } from './runtime/BroadcastBus';
import { registerStepExecutor, replayJournal } from './storage/WriteJournal';
import { persistMemoryRecord, type MemoryWriteInput } from './memory/MemoryEngine';
import type { Note } from './notes/NoteSchema';

let initPromise: Promise<void> | null = null;

/**
 * Phase-5 startup wiring (WR-01 / WR-04 / WR-05): called once per JS
 * context from every surface entrypoint (web preview, SidePanel, Full App
 * Tab). The idempotency guard is per-context — each extension surface runs
 * its own module instance; cross-context state (the MEM-02 election)
 * converges via BroadcastBus PRIMARY_SURFACE_ELECTED sync.
 *
 * - WR-04 (MEM-02): set the surface identity and elect this surface as
 *   primary so the single-writer gate is effective in production. Every
 *   context converges on the elected primary via the broadcast (last
 *   election wins; secondary contexts become read-only).
 * - WR-01: restore the persistent BM25 index before any search so search
 *   results survive extension reloads.
 * - WR-05: register replay executors for the phase-5 journal steps and
 *   replay interrupted entries so a crash between write-note and
 *   update-index (or write-memory-record and broadcast) recovers instead
 *   of leaving the entry stuck in `applying` forever.
 *
 * Never throws — startup wiring failures log and degrade to an empty (but
 * usable) index/journal state rather than crashing the surface.
 */
export function initializeKnowledgeBase(surfaceId: string): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        (globalThis as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__ = surfaceId;
        setPrimarySurfaceId(surfaceId);
        registerJournalExecutors();
        await noteSearchIndex.load();
        await replayJournal();
      } catch (err) {
        console.error('[knowledge-base] startup wiring failed:', err);
      }
    })();
  }
  return initPromise;
}

/**
 * Register replay executors for every phase-5 journal step name (WR-05).
 * Executors are idempotent — replay may re-run them across retries.
 */
function registerJournalExecutors(): void {
  registerStepExecutor('write-note', async (entry) => {
    // Restore the fully-derived note from the entry payload. Legacy
    // entries without a payload fall back to verifying the note reached
    // the store; if it never did, the data is unrecoverable and the step
    // fails honestly (never silently marked completed without the write).
    const payloadNote = (entry?.payload as { note?: Note } | undefined)?.note;
    if (payloadNote) {
      await notesDb.restore(payloadNote);
      return;
    }
    const found = await notesDb.get(entry?.targetIds?.noteId ?? '');
    if (!found.success) {
      throw new Error(
        `Cannot replay write-note: payload not in journal and note ${entry?.targetIds?.noteId ?? 'unknown'} not in store`,
      );
    }
  });

  registerStepExecutor('update-index', async () => {
    // Full rebuild from the notes store — idempotent and covers the
    // crash-between-write-note-and-update-index recovery case.
    const notes = await notesDb.getAll();
    await noteSearchIndex.rebuild(notes);
    await noteSearchIndex.persist();
  });

  registerStepExecutor('write-memory-record', async (entry) => {
    const record = (entry?.payload as { record?: MemoryWriteInput } | undefined)?.record;
    if (!record) {
      throw new Error('Cannot replay write-memory-record: record payload not persisted in journal');
    }
    await persistMemoryRecord(record);
  });

  registerStepExecutor('broadcast-workspace-update', async () => {
    publish('WORKSPACE_UPDATED', { source: 'memory' });
  });
}
