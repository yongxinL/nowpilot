/**
 * NoteChatConverter.ts — chat/page → structured note draft (LLM-WIKI-07,
 * NMEM-03, D-118).
 *
 * draftFromChat() converts a conversation into a structured NoteDraft:
 * memory context from MemoryEngine.assemble() enriches the prompt, a
 * fast-tier structured JSON call produces the draft, and LinkParser
 * extracts any [[wikilinks]] from the content. The draft is pre-filled
 * for user review — NEVER auto-saved (user is gatekeeper per LLM-WIKI-07).
 *
 * Object-form namespace export per established pattern.
 */

import { requestJson } from '../ai/StructuredOutput';
import { resolveTier } from '../ai/TierResolver';
import { ProviderRegistry } from '../ai/ProviderRegistry';
import { MemoryEngine } from '../memory/MemoryEngine';
import { parseLinks } from './LinkParser';
import { NoteDraftSchema } from './schemas';
import type { NoteDraft } from './schemas';
import { debugLog } from '../log/debugLog';

/** Fast-tier timeout (FIRST_TOKEN_TIMEOUT_MS precedent). */
const FAST_TIER_TIMEOUT_MS = 15_000;

/** Chat message shape (role + content). */
export interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Build the conversion prompt from messages + memory context. Chat content
 * is untrusted data (CTX-02) — it is passed as data, not as a system
 * instruction. The system prompt is handled by the provider call site.
 */
function buildPrompt(messages: ChatMessage[], memoryContext: string): string {
  const conversation = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const memory = memoryContext
    ? `\n\nUser memory context:\n${memoryContext}`
    : '';
  return `Convert the following conversation into a structured knowledge note.${memory}

Conversation:
${conversation}

Return JSON: {title, content(markdown), tags[string<=5], wikilinks[string[]], categoryPath(string|null), summary}.`;
}

/**
 * NoteChatConverter — chat/page → structured note draft facade (D-118).
 *
 * Methods:
 *   draftFromChat(messages, memoryContext?, abortSignal?) → Promise<NoteDraft>
 */
export const NoteChatConverter = {
  /**
   * Convert a conversation into a structured note draft. The draft is
   * pre-filled for user review — NEVER auto-saved (user is gatekeeper).
   *
   * @param messages — conversation messages (role + content).
   * @param memoryContext — optional injected memory context (test seam).
   *   When omitted, MemoryEngine.assemble() is called internally.
   * @param abortSignal — optional caller abort.
   * @returns NoteDraft pre-filled for user review.
   * @throws Error 'FAST_TIER_UNCONFIGURED' when the fast tier is not set.
   */
  async draftFromChat(
    messages: ChatMessage[],
    memoryContext?: string,
    abortSignal?: AbortSignal,
  ): Promise<NoteDraft> {
    // 1. Memory context (NMEM-03): use injected or call assemble().
    const memory = memoryContext ?? (await MemoryEngine.assemble());

    // 2. Fast-tier structured JSON call.
    const resolution = resolveTier('fast');
    if (!resolution) {
      throw new Error('FAST_TIER_UNCONFIGURED');
    }

    const prompt = buildPrompt(messages, memory);
    const operationId = `note-chat-convert-${Date.now()}`;

    let result: NoteDraft;
    try {
      result = await requestJson(NoteDraftSchema, prompt, {
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
    } catch (err) {
      debugLog('NOTE_CHAT_CONVERT_FAILED', 'Fast-tier draft call failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error('FAST_TIER_UNCONFIGURED');
    }

    // 3. Wikilink extraction: parse [[Title]] targets from content and
    //    merge with any the LLM already returned (dedupe).
    const extracted = parseLinks(result.content);
    const merged = [...result.wikilinks];
    for (const link of extracted) {
      if (!merged.includes(link)) merged.push(link);
    }

    return {
      title: result.title,
      content: result.content,
      tags: result.tags,
      wikilinks: merged,
      categoryPath: result.categoryPath,
      summary: result.summary ?? '',
    };
  },

  /**
   * Test seams.
   */
  __test__: {},
};
