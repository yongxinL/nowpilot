/**
 * NoteTagger.ts — LLM enrichment spine (D-115, LLM-WIKI-01/11, NMEM-02,
 * CAT-01/05). Single fast-tier, temperature-0 structured JSON call
 * returning tags + categoryPath + summary + memoryFacts.
 *
 * Pipeline (non-blocking):
 *   1. saveNote() emits NOTE_SAVED_EVENT.
 *   2. NoteTagger subscribes → fires analyze() fire-and-forget.
 *   3. On response: stale-guard (version check) → gateSuggestions() →
 *      emit NOTE_SUGGESTIONS_EVENT → route memoryFacts via MemoryEngine.
 *
 * D-06: NO background jobs — the subscription is in-process (UI context).
 * §0.2: LLM runs in UI contexts only, never background SW.
 */

import type { IDBPDatabase } from 'idb';
import { requestJson } from '../ai/StructuredOutput';
import { resolveTier } from '../ai/TierResolver';
import { ProviderRegistry } from '../ai/ProviderRegistry';
import { on, emit } from '../events/EventBus';
import {
  NoteTagResultSchema,
  gateSuggestions,
  normalizeCategoryPath,
} from './schemas';
import type { NoteTagResult } from './schemas';
import { NOTE_SAVED_EVENT, type NoteSavedPayload } from './save';
import type { Note } from '../../types/notes';
import type { NotesDBV1 } from '../storage/NotesDB';
import { isPrimaryWriter } from '../workspace/WorkspaceStore';
import { MemoryEngine } from '../memory/MemoryEngine';
import { debugLog } from '../log/debugLog';

/** Event emitted when LLM suggestions are ready for the UI. */
export const NOTE_SUGGESTIONS_EVENT = 'note:suggestions';

/** Payload for the note:suggestions event (UI-SPEC data contract). */
export interface NoteSuggestionsEvent {
  noteId: string;
  tags: string[];
  categoryPath: string | null;
  summary: string;
  memoryFacts: string[];
}

/** Fast-tier timeout per FIRST_TOKEN_TIMEOUT_MS (§20.10). */
const FAST_TIER_TIMEOUT_MS = 15_000;

/**
 * Build the analysis prompt for a note. Note content is untrusted data
 * (CTX-02) — it is passed as data, not as a system instruction. The
 * system prompt is handled by the provider call site.
 */
function buildPrompt(note: Note): string {
  return `Analyze the following note and return structured JSON matching the schema.

Title: ${note.title}
Content: ${note.content}`;
}

/**
 * NoteTagger — LLM enrichment facade (D-115).
 *
 * Methods:
 *   analyze(note, operationId, abortSignal?) → Promise<NoteTagResult>
 *   handleNoteSaved(db, payload)            → void (fire-and-forget)
 *   init(db)                                → () => void (unsubscribe)
 */
export const NoteTagger = {
  /**
   * Analyze a note via single fast-tier, temperature-0 structured JSON
   * call (LLM-WIKI-01). Returns validated NoteTagResult.
   *
   * @param note — the note to analyze.
   * @param operationId — Phase-1 OperationId for correlation (Flag C).
   * @param abortSignal — optional caller abort.
   * @throws Error 'FAST_TIER_UNCONFIGURED' when the fast tier is not set.
   */
  async analyze(
    note: Note,
    operationId: string,
    abortSignal?: AbortSignal,
  ): Promise<NoteTagResult> {
    const resolution = resolveTier('fast');
    if (!resolution) {
      throw new Error('FAST_TIER_UNCONFIGURED');
    }

    const prompt = buildPrompt(note);

    return requestJson(NoteTagResultSchema, prompt, {
      operationId,
      providerId: resolution.providerId,
      model: resolution.model,
      timeoutMs: FAST_TIER_TIMEOUT_MS,
      callProviderJsonMode: async (p, jsonSchema, signal) => {
        const provider = ProviderRegistry.getById(resolution.providerId)?.provider;
        if (!provider) {
          throw new Error(`Provider ${resolution.providerId} not registered`);
        }
        return provider.requestJson(p, jsonSchema, signal);
      },
      abortSignal: abortSignal ?? new AbortController().signal,
    });
  },

  /**
   * Non-blocking post-save handler (D-115, LLM-WIKI-11).
   *
   * Fires analyze() fire-and-forget. On response:
   *   1. Stale guard: re-read note, discard if version changed.
   *   2. Apply gateSuggestions() (threshold + cap).
   *   3. Emit NOTE_SUGGESTIONS_EVENT with gated payload.
   *   4. Route memoryFacts through MemoryEngine (NMEM-02, primary only).
   *
   * @param db — opened NotesDB instance for re-reading the note.
   * @param payload — NOTE_SAVED_EVENT payload.
   */
  handleNoteSaved(db: IDBPDatabase<NotesDBV1>, payload: NoteSavedPayload): void {
    // Fire-and-forget: do not block the save pipeline.
    void this.processNoteSaved(db, payload);
  },

  /**
   * Async implementation of handleNoteSaved (separated for testability).
   */
  async processNoteSaved(db: IDBPDatabase<NotesDBV1>, payload: NoteSavedPayload): Promise<void> {
    const { noteId } = payload;

    // Re-read the fresh note from DB.
    const note = await db.get('notes', noteId);
    if (!note) {
      debugLog('NOTE_TAGGER_NOTE_MISSING', 'Note not found for analysis', { noteId });
      return;
    }

    // Capture version at call time for stale guard (LLM-WIKI-11).
    const capturedVersion = note.version;

    // Normalize categoryPath on the note (CAT-01/05).
    if (note.categoryPath) {
      note.categoryPath = normalizeCategoryPath(note.categoryPath) ?? undefined;
    }

    let result: NoteTagResult;
    try {
      result = await this.analyze(note, `note-saved-${noteId}-${capturedVersion}`);
    } catch (err) {
      // LLM call failed — log and silently drop (non-blocking).
      debugLog('NOTE_TAGGER_ANALYZE_FAILED', 'analyze() failed', {
        noteId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Stale guard: re-read note, discard if version changed (LLM-WIKI-11).
    const currentNote = await db.get('notes', noteId);
    if (!currentNote || currentNote.version !== capturedVersion) {
      debugLog('NOTE_TAGGER_STALE', 'Suggestions discarded — note edited before LLM response', {
        noteId,
        capturedVersion,
        currentVersion: currentNote?.version,
      });
      return;
    }

    // Apply gateSuggestions (threshold + cap).
    const gated = gateSuggestions(result);

    // Emit note:suggestions event for the UI.
    emit<NoteSuggestionsEvent>(NOTE_SUGGESTIONS_EVENT, {
      noteId,
      tags: gated.tags,
      categoryPath: result.categoryPath,
      summary: result.summary,
      memoryFacts: gated.memoryFacts,
    });

    // NMEM-02: route memoryFacts through MemoryEngine on primary surface only.
    if (isPrimaryWriter() && result.memoryFacts.length > 0) {
      try {
        await MemoryEngine.upsert(
          result.memoryFacts.map((f) => ({
            content: f.content,
            confidence: f.confidence,
          })),
        );
      } catch (err) {
        debugLog('NOTE_TAGGER_MEMORY_UPSERT_FAILED', 'MemoryEngine.upsert failed', {
          noteId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },

  /**
   * Subscribe to NOTE_SAVED_EVENT. Returns an unsubscribe function.
   *
   * @param db — opened NotesDB instance passed to the handler.
   * @returns Unsubscribe function.
   */
  init(db: IDBPDatabase<NotesDBV1>): () => void {
    return on(NOTE_SAVED_EVENT, (payload) => {
      this.handleNoteSaved(db, payload as NoteSavedPayload);
    });
  },
};
