/**
 * NoteQA.ts — RAG "Ask notes" with citations (LLM-WIKI-05/06, NMEM-01,
 * D-117).
 *
 * ask() retrieves MiniSearch top-5 + MemoryEngine facts, assembles a
 * balanced-tier synthesis prompt, and returns a cited answer. When the
 * balanced tier is unavailable it falls back to keyword-only mode (no LLM
 * call). AI-enhanced rerank activates when <3 MiniSearch results or the
 * np_notes_llm_features.aiSearch flag is set.
 *
 * Object-form namespace export per established pattern (MiniSearchIndex,
 * MemoryEngine, NoteTagger).
 */

import type { IDBPDatabase } from 'idb';

import { requestJson } from '../ai/StructuredOutput';
import { resolveTier } from '../ai/TierResolver';
import { ProviderRegistry } from '../ai/ProviderRegistry';
import { query as miniSearchQuery } from '../search/MiniSearchIndex';
import { MemoryEngine } from '../memory/MemoryEngine';
import { NoteQAResultSchema } from './schemas';
import type { NoteQAResult } from './schemas';
import type { NotesDBV1 } from '../storage/NotesDB';
import { debugLog } from '../log/debugLog';

/** Balanced-tier timeout (§20.10 FIRST_TOKEN_TIMEOUT_MS precedent). */
const BALANCED_TIER_TIMEOUT_MS = 25_000;
/** Fast-tier timeout for rerank call. */
const FAST_TIER_TIMEOUT_MS = 15_000;
/** MiniSearch top-k fed into synthesis. */
const TOP_K = 5;

/** A single context item with source attribution for the synthesis prompt. */
interface ContextItem {
  source: string;
  title: string;
  snippet: string;
}

/** Rerank result schema (fast-tier call). */
const RerankResultSchema = z.object({
  order: z.array(z.string()).max(10),
});

import { z } from 'zod';

/**
 * Extended QA result returned to the UI. Includes the LLM-synthesized
 * NoteQAResult fields plus mode/fallback/rerank metadata.
 */
export interface NoteQAServiceResult {
  answer: string | null;
  citations: NoteQAResult['citations'];
  confidence: number;
  mode: 'ai-enhanced' | 'keyword-only';
  fallback: boolean;
  reranked: boolean;
}

/**
 * Read the np_notes_llm_features.aiSearch flag from chrome.storage.local.
 * Returns false when unset or on read error.
 */
async function getAiSearchFlag(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('np_notes_llm_features');
    const features = result['np_notes_llm_features'] as { aiSearch?: boolean } | undefined;
    return features?.aiSearch ?? false;
  } catch {
    return false;
  }
}

/**
 * Build the synthesis prompt from query + context items. Note content is
 * untrusted data (CTX-02) — it is passed as data, not as a system
 * instruction. The system prompt is handled by the provider call site.
 */
function buildSynthesisPrompt(query: string, context: ContextItem[]): string {
  const ctx = context
    .map((c, i) => `[${i + 1}] source=${c.source} title="${c.title}"\n${c.snippet}`)
    .join('\n\n');
  return `Answer the following question using ONLY the provided snippets. Cite each statement with the source title.

Question: ${query}

Snippets:
${ctx}`;
}

/**
 * NoteQA — RAG "Ask notes" facade (D-117).
 *
 * Methods:
 *   ask(query, db, abortSignal?) → Promise<NoteQAServiceResult>
 */
export const NoteQA = {
  /**
   * Ask a question against the user's notes. Retrieves MiniSearch top-5 +
   * MemoryEngine facts, synthesizes a balanced-tier answer with citations.
   *
   * @param query — the user's question.
   * @param db — opened NotesDB instance.
   * @param abortSignal — optional caller abort.
   * @returns NoteQAServiceResult with answer, citations, and mode metadata.
   */
  async ask(
    query: string,
    db: IDBPDatabase<NotesDBV1>,
    abortSignal?: AbortSignal,
  ): Promise<NoteQAServiceResult> {
    // 1. Retrieval: MiniSearch top-5.
    const hits = (await miniSearchQuery(db, query)).slice(0, TOP_K);

    // 2. Memory facts (NMEM-01) — default top-5 scored hints.
    const memoryHints = await MemoryEngine.retrieveMemoryHints(query);

    // 3. Context assembly with source attribution.
    const context: ContextItem[] = [
      ...hits.map((h) => ({
        source: h.id,
        title: h.title,
        snippet: h.content,
      })),
      ...memoryHints.map((m) => ({
        source: `memory:${m.id}`,
        title: m.type,
        snippet: m.content,
      })),
    ];

    // 4. Tier check — balanced tier required for synthesis.
    const resolution = resolveTier('balanced');
    if (!resolution) {
      debugLog('NOTEQA_TIER_UNAVAILABLE', 'Balanced tier not configured — keyword-only fallback', {
        query,
      });
      return {
        answer: null,
        citations: [],
        confidence: 0,
        mode: 'keyword-only',
        fallback: true,
        reranked: false,
      };
    }

    // 5. Synthesis via balanced-tier structured JSON call.
    const prompt = buildSynthesisPrompt(query, context);
    const operationId = `noteqa-${Date.now()}`;

    let result: NoteQAResult;
    try {
      result = await requestJson(NoteQAResultSchema, prompt, {
        operationId,
        providerId: resolution.providerId,
        model: resolution.model,
        timeoutMs: BALANCED_TIER_TIMEOUT_MS,
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
      debugLog('NOTEQA_SYNTHESIS_FAILED', 'Balanced-tier synthesis failed', {
        query,
        error: err instanceof Error ? err.message : String(err),
      });
      // On synthesis failure, return fallback (no LLM answer).
      return {
        answer: null,
        citations: [],
        confidence: 0,
        mode: 'keyword-only',
        fallback: true,
        reranked: false,
      };
    }

    // 6. AI rerank (LLM-WIKI-05): activate when <3 MiniSearch results or
    // aiSearch flag is set.
    const aiSearch = await getAiSearchFlag();
    const shouldRerank = hits.length < 3 || aiSearch;
    let reranked = false;

    if (shouldRerank) {
      reranked = await this.rerank(result, resolution, query);
    }

    return {
      answer: result.answer,
      citations: result.citations,
      confidence: result.confidence,
      mode: 'ai-enhanced',
      fallback: false,
      reranked,
    };
  },

  /**
   * Fast-tier rerank of synthesis citations by semantic relevance.
   * Reorders result.citations in place when the rerank succeeds.
   *
   * @returns true if the rerank was applied, false otherwise.
   */
  async rerank(
    result: NoteQAResult,
    resolution: { providerId: string; model: string },
    query: string,
  ): Promise<boolean> {
    const fastResolution = resolveTier('fast');
    if (!fastResolution) return false;

    const citationIds = result.citations.map((c) => c.noteId);
    if (citationIds.length < 2) return false; // nothing to reorder

    const prompt = `Given the query and note IDs below, return the note IDs ordered by relevance to the query (most relevant first).

Query: ${query}
Note IDs: ${JSON.stringify(citationIds)}`;

    try {
      const rerankResult = await requestJson(RerankResultSchema, prompt, {
        operationId: `noteqa-rerank-${Date.now()}`,
        providerId: fastResolution.providerId,
        model: fastResolution.model,
        timeoutMs: FAST_TIER_TIMEOUT_MS,
        callProviderJsonMode: async (p, jsonSchema, signal) => {
          const provider = ProviderRegistry.getById(fastResolution.providerId)?.provider;
          if (!provider) {
            throw new Error(`Provider ${fastResolution.providerId} not registered`);
          }
          return provider.requestJson(p, jsonSchema, signal);
        },
        abortSignal: new AbortController().signal,
      });

      // Reorder citations per the rerank result (preserve any not in order).
      const ordered = rerankResult.order.filter((id) => citationIds.includes(id));
      const reordered = ordered
        .map((id) => result.citations.find((c) => c.noteId === id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined);
      // Append any citations not returned by the rerank.
      for (const c of result.citations) {
        if (!ordered.includes(c.noteId)) reordered.push(c);
      }
      result.citations = reordered;
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Test seams.
   */
  __test__: {
    get TOP_K() {
      return TOP_K;
    },
  },
};
