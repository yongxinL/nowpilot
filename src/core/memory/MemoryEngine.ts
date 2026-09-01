// MemoryEngine — D-105 create-only orchestrator facade
// (PRODUCT_SPEC_v0_1.md §3.4/§3.5, spec 4572-4578).
//
// Produces the retrieved-memory + preference-profile data the Phase-7 trust
// layer already consumes (contextItems.ts:70-93: hint.id + hint.content,
// trust 'retrieved', authority false). Create-only: NO live chat /
// agent-orchestrator wiring edits (D-105/D-69/D-81 — grep-asserted).
//
// Methods:
//   retrieveConversationMemory(id) → { summary, recentTurns }
//   retrieveUserMemory(query, opts) → RetrievedMemory[] (top-5 / top-3 tiny / ≤1000 tokens)
//   buildPreferenceProfile()       → compact JSON incl. persona overrides (RICH-R-05 DONE-when)
//   retrieveMemoryHints(query)     → RetrievedMemory[] (Phase-7 [MEMORY] seam)
//   assemble(query?)               → compact memory context string (NMEM-03, D-118)
//   upsert(facts)                  → persist extracted memory facts (NMEM-02, D-123)
import type { ModelContextTier } from '../context/ModelContextTier';
import type { RetrievedMemory, UserMemoryFact } from './types';
import type { MemoryMessage } from '../storage/MemoryDB';
import { getScoredFacts, upsertFact } from './UserMemoryStore';
import { getSummary, getRecentTurns } from './ConversationMemoryStore';
import { usePreferenceMemoryStore } from './PreferenceMemoryStore';
import { countTokensHeuristic } from '../context/TokenBudget';

/** §3.4 injection (spec 630-635): default top-k = 5. */
export const MEMORY_HINTS_TOP_K = 5;
/** §3.4 injection (spec 630-635): tiny tier top-k = 3. */
export const MEMORY_HINTS_TINY_K = 3;
/** §3.4 injection (spec 630-635): cumulative token budget = 1000. */
export const MEMORY_HINTS_MAX_TOKENS = 1000;

/**
 * Create-only orchestrator facade (D-105). Object-form namespace export
 * (ProviderRegistry/PageIndexBuilder convention).
 */
export const MemoryEngine = {
  /**
   * Retrieve conversation memory: summary + recent turns.
   * Delegates to ConversationMemoryStore.
   */
  async retrieveConversationMemory(
    conversationId: string,
  ): Promise<{ summary: string | null; recentTurns: MemoryMessage[] }> {
    const [summary, recentTurns] = await Promise.all([
      getSummary(conversationId),
      getRecentTurns(conversationId, 6),
    ]);
    return { summary: summary?.summary ?? null, recentTurns };
  },

  /**
   * Retrieve user memory for a query: top-5 (top-3 tiny) scored facts
   * within a ≤1000-token budget. Never injects secrets (the store already
   * redacted at write; engine maps to the RetrievedMemory shape).
   *
   * @param query — raw query string.
   * @param opts.tier — model context tier ('tiny' → top-3).
   */
  async retrieveUserMemory(
    query: string,
    opts?: { tier?: ModelContextTier; now?: number },
  ): Promise<RetrievedMemory[]> {
    const k = opts?.tier === 'tiny' ? MEMORY_HINTS_TINY_K : MEMORY_HINTS_TOP_K;
    // Fetch extra candidates so the token budget can trim without starving k.
    const scored = await getScoredFacts(query, { k: k * 3, now: opts?.now });

    // Map to RetrievedMemory shape, cumulative token budget ≤ 1000.
    const results: RetrievedMemory[] = [];
    let tokenBudget = 0;
    for (const { fact, score } of scored) {
      const itemTokens = countTokensHeuristic(fact.content);
      if (tokenBudget + itemTokens > MEMORY_HINTS_MAX_TOKENS) break;
      tokenBudget += itemTokens;
      results.push({
        id: fact.id,
        content: fact.content,
        type: fact.type,
        tags: fact.tags,
        score,
      });
      if (results.length >= k) break;
    }
    return results;
  },

  /**
   * Build a compact preference-profile JSON (RICH-R-05 DONE-when).
   * Reads PreferenceMemoryStore state (personaId + persona + personaOverrides)
   * — NEVER the fact store (R2). Returns a compact serialization incl. the
   * overrides (the prefsCompact rendering precedent at contextItems.ts:143-152).
   */
  buildPreferenceProfile(): string {
    const state = usePreferenceMemoryStore.getState();
    const parts: string[] = [];
    parts.push(`personaId:${state.personaId}`);
    parts.push(`name:${state.persona.identity.name}`);
    parts.push(`tone:${state.persona.languageStyle.tone}`);
    parts.push(`brevity:${state.persona.languageStyle.brevity}`);
    const overrides = state.personaOverrides;
    if (overrides?.name) parts.push(`override.name:${overrides.name}`);
    if (overrides?.tone) parts.push(`override.tone:${overrides.tone}`);
    if (overrides?.brevity) parts.push(`override.brevity:${overrides.brevity}`);
    return JSON.stringify({ profile: parts.join(',') });
  },

  /**
   * Retrieve memory hints → RetrievedMemory[] for the Phase-7 [MEMORY] trust
   * builder (contextItems.ts:70-93: hint.id + hint.content, trust 'retrieved',
   * authority false). Same top-k/token budget as retrieveUserMemory.
   * This is the producer of the memoryHints seam the Phase-7 trust layer
   * consumes (the input.memoryHints contract).
   */
  async retrieveMemoryHints(
    query: string,
    opts?: { tier?: ModelContextTier; now?: number },
  ): Promise<RetrievedMemory[]> {
    return this.retrieveUserMemory(query, opts);
  },

  /**
   * Assemble compact memory context for note drafting (NMEM-03, D-118).
   *
   * Formats retrieved memory hints as a bullet-point context string for
   * NoteChatConverter. Returns empty string when no memories found.
   *
   * @param query — optional query to scope the memory retrieval.
   * @returns Compact multi-line context string (bullet points).
   */
  async assemble(query?: string): Promise<string> {
    const hints = await this.retrieveMemoryHints(query ?? '');
    if (hints.length === 0) return '';
    return hints.map((h) => `- [${h.type}] ${h.content}`).join('\n');
  },

  /**
   * Upsert memory facts extracted by NoteTagger (NMEM-02, D-123).
   *
   * Transforms NoteTagger memoryFacts ({ content, confidence }[]) into the
   * canonical UserMemoryFact shape and persists each via UserMemoryStore.
   * The isPrimaryWriter() gate is enforced by the caller (NoteTagger) before
   * invoking this method — this method does NOT re-check.
   *
   * @param facts — extracted memory facts from NoteTagger.analyze().
   */
  async upsert(
    facts: Array<{ content: string; confidence: number }>,
  ): Promise<void> {
    const now = Date.now();
    for (const f of facts) {
      const fact: UserMemoryFact = {
        id: `nf-${now}-${Math.random().toString(36).slice(2, 10)}`,
        content: f.content,
        type: 'fact',
        tags: [],
        confidence: f.confidence,
        source: 'inferred',
        createdAt: now,
        updatedAt: now,
        useCount: 0,
      };
      await upsertFact(fact);
    }
  },
};
