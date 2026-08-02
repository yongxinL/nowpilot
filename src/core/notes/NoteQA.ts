import { z } from 'zod';
import { getLlmService } from '../ai/LlmService';
import type { ProviderAdapter } from '../ai/providers/ProviderAdapter';
import type { ModelTier } from '../ai/types';
import { getMemoryEngine } from '../memory/MemoryEngine';
import type { ContextItem } from '../context/ContextItem';
import { noteSearchIndex } from './MiniSearchNoteIndex';
import { getNotesDb } from './NotesDB';
import { NoteQAResultSchema, type NoteQAResult } from './NoteSchema';
import type { NoteSearchResult } from './types';

/**
 * NoteQA — RAG question-answering over the note knowledge base (D-13..D-16).
 *
 * Two modes via a single `query()` entry point:
 * - `ask`: MiniSearch top-5 snippets + MemoryEngine facts → flash-tier
 *   synthesis with numbered `[1]..[N]` citation markers (D-13, D-15).
 *   Post-processed into a validated, deduplicated Citation[].
 * - `search`: MiniSearch top-10 → haiku-tier rerank → ordered
 *   NoteSearchResult[] (falls back to raw BM25 order on LLM failure).
 *
 * Tiny model tier (D-16): no LLM call at all — raw MiniSearch results plus
 * MemoryEngine facts, with noteId links intact, returned as
 * NoteSearchResult[].
 *
 * Prompt assembly is self-contained (D-14) — no ContextOptimizer.
 * LLM calls fire only on explicit user questions (prohibition NOTE-02).
 */

export type NoteQaMode = 'search' | 'ask';

/**
 * LLM tier for synthesis, or `TINY` for the raw no-LLM path (D-16).
 * The codebase ModelTier union has no `FLASH` member — ask-mode synthesis
 * maps to BALANCED (the flash-class tier in provider adapter tables).
 */
export type NoteQaTier = ModelTier | 'TINY';

export interface NoteQaParams {
  mode: NoteQaMode;
  question: string;
  tier: NoteQaTier;
  abortSignal?: AbortSignal;
}

export interface Citation {
  noteId: string;
  title: string;
  relevantSnippet: string;
  referenceNumber: number;
}

/** Snippet metadata for prompt assembly and citation validation (D-13). */
export interface SnippetInfo {
  noteId: string;
  title: string;
  snippet: string;
}

/** Context-window tier for MemoryEngine.retrieve() (its own union). */
const MEMORY_CONTEXT_TIER = 'medium' as const;
/** MemoryEngine conversation scope — NoteQA has no conversation context. */
const MEMORY_CONVERSATION_ID = 'note-qa';

const ASK_SNIPPET_LIMIT = 5;
const SEARCH_SNIPPET_LIMIT = 10;
const MEMORY_FACT_LIMIT = 3;

/** Minimal rerank output — the LLM returns 1-based relevance order. */
const RERANK_SCHEMA = z.object({ order: z.array(z.number().int().positive()) });

export const NOTE_QA_ASK_SYSTEM_PROMPT = `You are a RAG question-answering engine for a local knowledge base.

Answer the question using ONLY the provided snippets and memory facts.
Reference sources using [1], [2], [3] markers inline.
Each [N] corresponds to Snippet N above. Do not invent references.
If no snippet is relevant, say "I couldn't find relevant notes to answer this question."
Output as valid JSON matching the schema: { "answer": string, "citations": [ { "noteId": string, "title": string, "relevantSnippet": string, "referenceNumber": number } ] }.`;

export const NOTE_QA_RERANK_SYSTEM_PROMPT = `You are a search reranking engine. You are given numbered snippets [1], [2], ...
Reorder them by relevance to the question. Return ONLY a valid JSON object: { "order": [numbers...] }
where order lists the 1-based snippet numbers sorted by relevance (most relevant first).`;

/**
 * D-13 citation parsing: extracts [N] markers from the answer text,
 * validates each N against the snippet array (1 ≤ N ≤ snippets.length),
 * and deduplicates repeated references. Used for LLM post-processing and
 * tiny-mode raw result assembly.
 */
export function parseCitations(rawText: string, snippets: SnippetInfo[]): Citation[] {
  const citations: Citation[] = [];
  const usedRefs = new Set<number>();
  for (const match of rawText.matchAll(/\[(\d+)\]/g)) {
    const refNum = parseInt(match[1], 10);
    if (usedRefs.has(refNum) || refNum < 1 || refNum > snippets.length) continue;
    usedRefs.add(refNum);
    const snippet = snippets[refNum - 1];
    citations.push({
      noteId: snippet.noteId,
      title: snippet.title,
      relevantSnippet: snippet.snippet,
      referenceNumber: refNum,
    });
  }
  return citations;
}

/**
 * Build SnippetInfo[] with real titles for the top-N search results —
 * NoteSearchResult carries no title, so titles are resolved from NotesDB.
 */
async function resolveSnippetTitles(results: NoteSearchResult[]): Promise<SnippetInfo[]> {
  const titles = new Map<string, string>();
  for (const r of results) {
    const found = await getNotesDb().get(r.noteId);
    if (found.success) titles.set(r.noteId, found.note.title);
  }
  return results.map((r) => ({
    noteId: r.noteId,
    title: titles.get(r.noteId) ?? '',
    snippet: r.snippet,
  }));
}

export class NoteQA {
  /** D-14: NoteQA assembles its own prompt — no ContextOptimizer. */
  private buildAskPrompt(snippets: SnippetInfo[], memoryItems: ContextItem[], question: string): string {
    const lines: string[] = [];
    snippets.forEach((s, i) => {
      lines.push(`[Snippet ${i + 1}] (noteId: ${s.noteId}) Title: ${s.title}`);
      lines.push(`Content: ${s.snippet}`);
    });
    if (memoryItems.length > 0) {
      lines.push('[Memory facts]');
      for (const item of memoryItems) {
        lines.push(`- ${item.text}`);
      }
    }
    lines.push(`Question: ${question}`);
    return lines.join('\n');
  }

  /** Memory facts for RAG context — top 3 by relevance (D-14 budget). */
  private async retrieveMemory(query: string): Promise<ContextItem[]> {
    const result = await getMemoryEngine().retrieve({
      conversationId: MEMORY_CONVERSATION_ID,
      query,
      tier: MEMORY_CONTEXT_TIER,
    });
    if (!result.success) return [];
    return result.items.slice(0, MEMORY_FACT_LIMIT);
  }

  /**
   * Citation post-processing: marker-derived citations win; when the LLM
   * returned no inline markers, its citations array is validated against
   * the snippet indices and deduplicated (prohibition: never cite
   * non-existent notes).
   */
  private buildCitations(
    llmResult: { answer: string; citations: Citation[] },
    snippets: SnippetInfo[],
  ): Citation[] {
    const fromMarkers = parseCitations(llmResult.answer, snippets);
    if (fromMarkers.length > 0) return fromMarkers;

    const used = new Set<number>();
    const out: Citation[] = [];
    for (const c of llmResult.citations ?? []) {
      if (used.has(c.referenceNumber)) continue;
      if (c.referenceNumber < 1 || c.referenceNumber > snippets.length) continue;
      used.add(c.referenceNumber);
      // WR-05: rebuild from the snippet array by index — the LLM is not
      // trusted for note identity (T-05a-08). Its noteId/title/
      // relevantSnippet fields are IGNORED entirely; only the snippet
      // data derived from the actual index is authoritative (D-13:
      // never cite non-existent notes).
      const s = snippets[c.referenceNumber - 1];
      out.push({
        noteId: s.noteId,
        title: s.title,
        relevantSnippet: s.snippet,
        referenceNumber: c.referenceNumber,
      });
    }
    return out;
  }

  /** Ask mode: MiniSearch top-5 + memory → flash synthesis with citations. */
  private async ask(
    adapter: ProviderAdapter,
    params: NoteQaParams,
  ): Promise<NoteQAResult | NoteSearchResult[]> {
    const snippets = await resolveSnippetTitles(noteSearchIndex.search(params.question, ASK_SNIPPET_LIMIT));
    const memoryItems = await this.retrieveMemory(params.question);

    // D-16: tiny model tier — raw results with noteId links, no LLM call.
    if (params.tier === 'TINY') {
      const memoryResults: NoteSearchResult[] = memoryItems.map((item) => ({
        noteId: item.sourceId,
        score: item.relevance,
        matchedFields: [],
        snippet: item.text,
      }));
      const rawSnippets: NoteSearchResult[] = snippets.map((s) => ({
        noteId: s.noteId,
        score: 0,
        matchedFields: [],
        snippet: s.snippet,
      }));
      return [...rawSnippets, ...memoryResults];
    }

    const result = await getLlmService().generate({
      adapter,
      tier: 'BALANCED',
      systemPrompt: NOTE_QA_ASK_SYSTEM_PROMPT,
      userPrompt: this.buildAskPrompt(snippets, memoryItems, params.question),
      schema: NoteQAResultSchema,
      abortSignal: params.abortSignal,
    });

    return {
      answer: result.answer,
      citations: this.buildCitations(result as { answer: string; citations: Citation[] }, snippets),
    };
  }

  /** Search mode: MiniSearch top-10 → haiku rerank → ordered results. */
  private async search(adapter: ProviderAdapter, params: NoteQaParams): Promise<NoteSearchResult[]> {
    const results = noteSearchIndex.search(params.question, SEARCH_SNIPPET_LIMIT);

    // D-16: tiny model tier — raw BM25 order, no LLM call.
    if (params.tier === 'TINY') return results;

    try {
      const reranked = await getLlmService().generate({
        adapter,
        tier: 'FAST',
        systemPrompt: NOTE_QA_RERANK_SYSTEM_PROMPT,
        userPrompt: `Question: ${params.question}\n\n${results
          .map((r, i) => `[${i + 1}] (${r.noteId}) ${r.snippet}`)
          .join('\n')}`,
        schema: RERANK_SCHEMA,
        abortSignal: params.abortSignal,
      });
      const seen = new Set<number>();
      const ordered: NoteSearchResult[] = [];
      for (const n of reranked.order) {
        if (seen.has(n)) continue;
        seen.add(n);
        const idx = n - 1;
        if (idx >= 0 && idx < results.length) {
          ordered.push(results[idx]);
        }
      }
      return ordered.length > 0 ? ordered : results;
    } catch {
      // LLM failure → raw BM25 order fallback.
      return results;
    }
  }

  /**
   * Single entry point (D-15). Empty/whitespace question → null, no
   * MiniSearch call, no LLM call.
   */
  async query(
    adapter: ProviderAdapter,
    params: NoteQaParams,
  ): Promise<NoteQAResult | NoteSearchResult[] | null> {
    const question = params.question?.trim() ?? '';
    if (!question) return null;
    return params.mode === 'ask' ? this.ask(adapter, params) : this.search(adapter, params);
  }
}

// ── Singleton (module-level, MemoryEngine pattern) ───────────────────────────
let _instance: NoteQA | null = null;

export function getNoteQA(): NoteQA {
  if (!_instance) {
    _instance = new NoteQA();
  }
  return _instance;
}

export function resetNoteQA(): void {
  _instance = null;
}
