import { getLlmService } from '../ai/LlmService';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import { getMemoryEngine } from '../memory/MemoryEngine';
import { NoteDraftSchema, type NoteDraft } from './NoteSchema';

/**
 * NoteChatConverter — chat/page → pre-filled note draft (D-20, MEM-03).
 *
 * A single haiku-tier structured LLM call assembles a NoteDraft (title,
 * content, tags, categoryPath, wikilinks) using MemoryEngine context so
 * drafts reflect user facts, preferences, and persona (MEM-03). The UI
 * (Phase 7) pre-fills the note editor with the draft — the user is the
 * gatekeeper and must explicitly save. When saved, the note flows through
 * the full pipeline (NoteTagger enrichment + NoteFileSync backup + MEM-02
 * extraction) with provenance `chat-conversion` (already a valid value in
 * NoteProvenanceSchema).
 *
 * Fire-and-forget exemption: unlike NoteTagger, LLM errors propagate as
 * PipelineError through convert() so the UI can surface draft failures.
 */

export const NOTE_CHAT_CONVERTER_SYSTEM_PROMPT = `You are a note-taking assistant. Based on the conversation, draft an atomic note. Extract the key insight as the title. Write concise content in markdown. Suggest 1-5 relevant tags. Optionally suggest a category path and any wikilinks to other topics. Output valid JSON matching the schema: { "title": string, "content": string, "tags": string[], "categoryPath": string, "wikilinks": string[] }.`;

/** MemoryEngine conversation scope — draft context has no conversation history. */
const MEMORY_CONVERSATION_ID = 'note-chat-converter';
const MEMORY_CONTEXT_TIER = 'medium' as const;

export interface NoteChatConverterInput {
  chatMessages: string[];
  sourceUrl?: string;
  abortSignal?: AbortSignal;
}

export class NoteChatConverter {
  /**
   * MEM-03 context: assemble a plain-text context block from MemoryEngine
   * retrieve() items (the `assemble()` method from the phase spec does not
   * exist in MemoryEngine — retrieve() + join is the in-codebase analog).
   */
  private async assembleMemoryContext(): Promise<string> {
    const result = await getMemoryEngine().retrieve({
      conversationId: MEMORY_CONVERSATION_ID,
      query: 'note draft context',
      tier: MEMORY_CONTEXT_TIER,
    });
    if (!result.success) return '';
    return result.items.map((item) => item.text).join('\n');
  }

  async convert(
    adapter: ProviderAdapter,
    input: NoteChatConverterInput,
  ): Promise<NoteDraft> {
    const context = await this.assembleMemoryContext();
    const userPrompt = [
      context ? `Context:\n${context}\n\n` : '',
      'Chat messages:',
      input.chatMessages.map((msg, i) => `[${i + 1}] ${msg}`).join('\n'),
      input.sourceUrl ? `\nSource URL: ${input.sourceUrl}` : '',
    ].join('\n');

    return getLlmService().generate({
      adapter,
      tier: 'FAST',
      systemPrompt: NOTE_CHAT_CONVERTER_SYSTEM_PROMPT,
      userPrompt,
      schema: NoteDraftSchema,
      abortSignal: input.abortSignal,
    });
  }
}

// ── Singleton (module-level, MemoryEngine pattern) ───────────────────────────
let _instance: NoteChatConverter | null = null;

export function getNoteChatConverter(): NoteChatConverter {
  if (!_instance) {
    _instance = new NoteChatConverter();
  }
  return _instance;
}

export function resetNoteChatConverter(): void {
  _instance = null;
}
