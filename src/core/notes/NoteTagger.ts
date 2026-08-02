import { getLlmService } from '../ai/LlmService';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import { getNotesDb } from './NotesDB';
import { emit, on } from '../events/EventBus';
import {
  NoteTaggerResultSchema,
  type MemoryFact,
  type NoteEnrichment,
  type NoteTaggerResult,
} from './NoteSchema';
import type { MemoryWriteInput } from '../memory/MemoryEngine';

// ── D-04 local constants ─────────────────────────────────────────────────────
/** MemoryFacts with LLM confidence below this are never shown as suggestions. */
export const MIN_CONFIDENCE = 0.3;
/** Max memoryFacts displayed per note save. */
export const MAX_MEMORY_FACTS = 3;

// ── D-06 toggle state ────────────────────────────────────────────────────────
export interface NoteTaggerToggles {
  autoTag: boolean;
  autoCategorize: boolean;
  autoSummary: boolean;
  memoryExtraction: boolean;
}

export const DEFAULT_TAGGER_TOGGLES: NoteTaggerToggles = {
  autoTag: true,
  autoCategorize: true,
  autoSummary: true,
  memoryExtraction: true,
};

/** Payload of the `note:enriched` EventBus event (D-05 in-memory suggestions). */
export interface NoteEnrichedEvent {
  noteId: string;
  enrichment: NoteEnrichment;
  memoryFacts: MemoryFact[];
}

/**
 * NoteTagger — LLM enrichment + memory extraction service (Phase 5a).
 *
 * Subscribes to `note:saved` (D-17) and fires a single non-blocking
 * haiku-tier structured-output call (D-01) returning two partitions:
 * `enrichment` (tags/category/summary/concepts suggestions) and
 * `memoryFacts` (memory extraction candidates). Results are routed as
 * in-memory suggestions via the `note:enriched` event (D-05) — never
 * auto-applied to notes (user-gated per D-02) and never persisted.
 *
 * Error model: fire-and-forget. LLM errors and stale results are silently
 * discarded (D-07) — the handler never throws and never blocks note saves.
 */
export class NoteTagger {
  /** D-01 contract: single JSON object with enrichment + memoryFacts partitions. */
  static NOTE_TAGGER_SYSTEM_PROMPT = `You are a note enrichment engine for a local knowledge base.

Analyze the note content and respond with ONLY a valid JSON object with exactly two keys:
1. "enrichment": {
     "tags": array of up to 5 concise lowercase tags,
     "categoryPath": a slash-separated category path string or null,
     "summary": a summary of at most 200 characters,
     "suggestedConcepts": array of { "slug", "label", "summary" } concept suggestions (may be empty)
   }
2. "memoryFacts": array of up to 5 durable facts about the user that can be inferred from the note, each:
   { "type": "semantic", "content": string, "confidence": number between 0 and 1, "reason": string }

Rules:
- Do NOT include markdown fences or any text outside the JSON object.
- Only include facts you are confident about; use low confidence for uncertain inferences.
- Base everything strictly on the note content — never invent facts.`;

  private adapter: ProviderAdapter | null = null;
  private toggles: NoteTaggerToggles = { ...DEFAULT_TAGGER_TOGGLES };

  /**
   * Configure the provider adapter used by the `note:saved` handler.
   * Phase 7 UI sets this from user configuration (RESEARCH Open Q1);
   * direct `analyze()` callers pass the adapter explicitly.
   */
  setAdapter(adapter: ProviderAdapter | null): void {
    this.adapter = adapter;
  }

  /** Merge partial toggle changes (D-06). */
  setToggles(toggles: Partial<NoteTaggerToggles>): void {
    this.toggles = { ...this.toggles, ...toggles };
  }

  getToggles(): NoteTaggerToggles {
    return { ...this.toggles };
  }

  /**
   * Single haiku-tier structured LLM call returning both partitions (D-01).
   * Errors are silently discarded — returns null instead of throwing
   * (fire-and-forget contract; the EventBus handler never propagates).
   */
  async analyze(
    adapter: ProviderAdapter,
    _noteId: string,
    noteContent: string,
    _noteVersion: number,
    abortSignal?: AbortSignal,
  ): Promise<NoteTaggerResult | null> {
    try {
      return await getLlmService().generate({
        adapter,
        tier: 'FAST',
        systemPrompt: NoteTagger.NOTE_TAGGER_SYSTEM_PROMPT,
        userPrompt: `Note content:\n${noteContent}`,
        schema: NoteTaggerResultSchema,
        abortSignal,
      });
    } catch (err) {
      this.logDebug('enrichment LLM call failed — silently discarded', err);
      return null;
    }
  }

  /**
   * D-04 filtering: drop memoryFacts with LLM confidence < MIN_CONFIDENCE,
   * then cap the remainder at MAX_MEMORY_FACTS.
   */
  filterMemoryFacts(facts: MemoryFact[]): MemoryFact[] {
    return facts.filter((f) => f.confidence >= MIN_CONFIDENCE).slice(0, MAX_MEMORY_FACTS);
  }

  /**
   * D-03 mapping: LLM-reported confidence is display-only metadata — it is
   * NEVER used as the system confidence tier. Accepted facts are stored via
   * MemoryEngine.write() with `source: 'inferred'`, which the store derives
   * to confidence 0.5 per the CONFIDENCE_MAP (Phase 5 D-07).
   */
  toMemoryFactInput(fact: MemoryFact, _llmConfidence: number): MemoryWriteInput {
    return {
      content: fact.content,
      memoryType: 'semantic',
      tags: [],
      source: 'inferred',
      sensitivity: 'private',
    };
  }

  /**
   * Subscribe to `note:saved` (D-17). Idempotent — a second call is a
   * no-op. Handler flow: D-06 toggle gate → load note → non-blocking LLM
   * call → D-07 staleness check → D-04 filter → `note:enriched` event.
   */
  initNoteTagger(): void {
    if (unsub) return;
    unsub = on<{ noteId: string; version?: number }>('note:saved', ({ noteId, version }) => {
      void this.handleNoteSaved(noteId, version);
    });
  }

  private async handleNoteSaved(noteId: string, payloadVersion?: number): Promise<void> {
    try {
      // D-06: if autoTag + autoCategorize + autoSummary are all off, skip entirely
      const { autoTag, autoCategorize, autoSummary } = this.toggles;
      if (!autoTag && !autoCategorize && !autoSummary) {
        this.logDebug('skipped — all enrichment toggles off');
        return;
      }

      const found = await getNotesDb().get(noteId);
      if (!found.success) return;

      // D-07: capture the note version the request was made against
      // (payload version preferred when the emitter provides it).
      const capturedVersion = payloadVersion ?? found.note.version;

      if (!this.adapter) {
        this.logDebug('skipped — no provider adapter configured');
        return;
      }

      const result = await this.analyze(
        this.adapter,
        noteId,
        found.note.content,
        capturedVersion,
      );
      if (!result) return;

      // D-07: re-read the note — if the version moved, discard stale suggestions
      const current = await getNotesDb().get(noteId);
      if (!current.success || current.note.version !== capturedVersion) {
        this.logDebug('discarded stale suggestions — note version changed');
        return;
      }

      // D-06: when memory extraction is off, the call still runs (prompt
      // invariant) but memoryFacts are discarded. D-04 filters + caps.
      const memoryFacts = this.toggles.memoryExtraction
        ? this.filterMemoryFacts(result.memoryFacts)
        : [];

      // D-05: in-memory suggestions only — UI stores in component state.
      emit<NoteEnrichedEvent>('note:enriched', {
        noteId,
        enrichment: result.enrichment,
        memoryFacts,
      });
    } catch (err) {
      // Fire-and-forget: any handler error is silently discarded
      this.logDebug('note:saved handler error — silently discarded', err);
    }
  }

  private logDebug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[NoteTagger] ${message}`, ...args);
    }
  }
}

// ── Singleton (module-level, MemoryEngine/ContextOptimizer pattern) ─────────
let _instance: NoteTagger | null = null;
let unsub: (() => void) | null = null;

export function getNoteTagger(): NoteTagger {
  if (!_instance) {
    _instance = new NoteTagger();
  }
  return _instance;
}

export function resetNoteTagger(): void {
  // Unsubscribe first so a stale handler never fires on a discarded
  // instance and the module-level idempotency guard stays honest.
  if (unsub) {
    unsub();
    unsub = null;
  }
  _instance = null;
}
