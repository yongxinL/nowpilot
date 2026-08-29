// PageIndexBuilder — the ephemeral per-tab retrieval index (D-87 / §26.5).
//
// ROADMAP SC-4: builds a LAZY, MEMOIZED, per-tab MiniSearch index over
// extracted markdown, chunked BY HEADING (h1–h6) with fields title/url/
// headingPath (breadcrumb)/sectionText + an index-wide tabId. Content before
// the first heading → a synthetic '(preamble)' chunk; no-heading pages →
// paragraph-block chunks (blank-line separated) under the page title; a
// section exceeding INDEX_CHUNK_MAX_TOKENS (500, via the Phase-5
// countTokensHeuristic) splits into paragraph sub-chunks inheriting the same
// headingPath. When the tab's extracted tokens exceed the 2,000-token webpage
// budget (§22.2), selectRelevant(query) returns the top-k chunks and records
// compressionApplied: 'topk' (the Phase-5 CompressionType literal, D-87 —
// the Phase-7 context receipt consumes the manifest record).
//
// EPHEMERAL BY SPEC (§26.5 / D-87): the index is NEVER persisted — zero
// storage-area imports of any kind (grep-assertable). The persistent notes
// wrapper (src/core/search/MiniSearchIndex.ts) is Phase 8, NOT built here.
//
// Eviction-together (§26.4a / D-87): this builder's evict() is registered into
// the 06-03 PageContentCache eviction hook at module load — an extraction
// eviction always drops the index too (never orphan an index). One-directional
// import: the builder imports the cache; the cache never imports the builder.
import MiniSearch from 'minisearch';

import { countTokensHeuristic } from '../context/TokenBudget';
import type { CompressionType } from '../context/types';
import { INDEX_CHUNK_MAX_TOKENS } from './strategies/IExtractionStrategy';
import { PageContentCache } from './PageContentCache';

/** §22.2 per-source token budget for a webpage — the selectRelevant ceiling. */
export const WEBPAGE_TOKEN_BUDGET = 2000;

/** Synthetic headingPath for content before the first heading (§26.5). */
export const PREAMBLE_CHUNK = '(preamble)';

/** One heading-chunked MiniSearch document (§26.5 fields + synthesized id). */
export interface PageChunk {
  /** Synthesized `${headingPath}:${index}` — MiniSearch's default idField is 'id' (Pitfall 5). */
  id: string;
  /** Index-wide tabId carried on every chunk. */
  tabId: number;
  title: string;
  url: string;
  /** Heading breadcrumb ('H1' → 'H1 > H2'); '(preamble)' or the page title for no-heading pages. */
  headingPath: string;
  sectionText: string;
}

export interface IndexSource {
  markdown: string;
  title: string;
  url: string;
}

/** A MiniSearch hit with the stored PageChunk fields merged in. */
export type IndexHit = { id: string; score: number } & PageChunk;

/** Split a heading section into blank-line-separated paragraph blocks. */
const PARAGRAPH_BREAK = /\n\s*\n/;

const HEADING_RE = /^(#{1,6})\s+(.+)$/;

/**
 * §26.5 verbatim chunking: split markdown on heading boundaries tracking a
 * breadcrumb headingPath per heading; pre-heading text → the synthetic
 * '(preamble)' chunk; no headings → paragraph-block chunks under the page
 * title; a section over INDEX_CHUNK_MAX_TOKENS splits into paragraph
 * sub-chunks inheriting the same headingPath. Every chunk carries the
 * synthesized id `${headingPath}:${index}` (unique within the document) and
 * the index-wide tabId.
 */
export function chunkMarkdown(markdown: string, tabId: number, title: string, url: string): PageChunk[] {
  const chunks: PageChunk[] = [];
  let chunkIndex = 0;

  const emit = (headingPath: string, rawText: string): void => {
    const text = rawText.trim();
    if (text === '') return;
    if (countTokensHeuristic(text) > INDEX_CHUNK_MAX_TOKENS) {
      // Oversized section (§26.5): paragraph sub-chunks inheriting the path.
      for (const para of text.split(PARAGRAPH_BREAK)) {
        const trimmed = para.trim();
        if (trimmed === '') continue;
        chunks.push({ id: `${headingPath}:${chunkIndex}`, tabId, title, url, headingPath, sectionText: trimmed });
        chunkIndex += 1;
      }
      return;
    }
    chunks.push({ id: `${headingPath}:${chunkIndex}`, tabId, title, url, headingPath, sectionText: text });
    chunkIndex += 1;
  };

  const lines = markdown.split('\n');
  let headingPath = '';
  let preambleLines: string[] = [];
  let sectionLines: string[] = [];
  const levels: number[] = [];

  const flushSection = (): void => {
    if (sectionLines.length === 0) return;
    emit(headingPath, sectionLines.join('\n'));
    sectionLines = [];
  };

  for (const line of lines) {
    const heading = HEADING_RE.exec(line);
    if (heading !== null) {
      // Heading boundary: flush the pending preamble (on the FIRST heading) or
      // the pending section, then advance the breadcrumb.
      if (headingPath === '') {
        emit(PREAMBLE_CHUNK, preambleLines.join('\n'));
        preambleLines = [];
      } else {
        flushSection();
      }
      const level = heading[1].length;
      while (levels.length > 0 && levels[levels.length - 1] >= level) levels.pop();
      levels.push(level);
      headingPath = levels.map((l) => `H${l}`).join(' > ');
      sectionLines = [];
    } else if (headingPath === '') {
      preambleLines.push(line);
    } else {
      sectionLines.push(line);
    }
  }

  if (headingPath === '') {
    // No headings at all: paragraph-block chunks under the page title.
    for (const para of preambleLines.join('\n').split(PARAGRAPH_BREAK)) {
      const trimmed = para.trim();
      if (trimmed === '') continue;
      chunks.push({ id: `${title}:${chunkIndex}`, tabId, title, url, headingPath: title, sectionText: trimmed });
      chunkIndex += 1;
    }
  } else {
    flushSection();
  }

  return chunks;
}

/** §26.5 index construction — fields + storeFields [title,url,headingPath,
 * sectionText], boost { title: 3, headingPath: 2 }, prefix + fuzzy 0.2. */
export function buildIndex(chunks: PageChunk[]): MiniSearch<PageChunk> {
  const index = new MiniSearch<PageChunk>({
    fields: ['title', 'url', 'headingPath', 'sectionText'],
    storeFields: ['title', 'url', 'headingPath', 'sectionText'],
    searchOptions: { boost: { title: 3, headingPath: 2 }, prefix: true, fuzzy: 0.2 },
  });
  index.addAll(chunks);
  return index;
}

// ---------------------------------------------------------------------------
// Module state (per-surface singleton — ProviderRegistry module-Map style)
// ---------------------------------------------------------------------------

/** Lazy, memoized per-tab indexes (built on first query(); evicted with the extraction). */
const perTabIndexes = new Map<number, MiniSearch<PageChunk>>();
/** Lazy-build counter (__test__ seam — proves the chunker runs exactly once per tab). */
let lazyBuildCount = 0;

/** Get (or lazily build) the tab's index from the source markdown. */
function getIndex(tabId: number, source: IndexSource): MiniSearch<PageChunk> {
  const existing = perTabIndexes.get(tabId);
  if (existing !== undefined) return existing; // memoized — §26.5 'built once'
  const index = buildIndex(chunkMarkdown(source.markdown, tabId, source.title, source.url));
  perTabIndexes.set(tabId, index);
  lazyBuildCount += 1;
  return index;
}

/** Lazy query: builds the tab's index on first call, searches it thereafter. */
function query(tabId: number, q: string, source: IndexSource): IndexHit[] {
  // MiniSearch spreads the stored fields onto each result at runtime; its
  // static SearchResult type only declares { id, terms, queryTerms, score,
  // match } — the stored PageChunk fields need the explicit projection.
  return getIndex(tabId, source).search(q) as unknown as IndexHit[];
}

/** §22.2 budget-aware retrieval: the top-k scored chunks whose combined
 * tokens fit within WEBPAGE_TOKEN_BUDGET, with the 'topk' compression record
 * (D-87 — the caller gates on the source's total tokens exceeding the budget;
 * minimal mode §2.5 always routes through this). */
function selectRelevant(
  tabId: number,
  q: string,
  source: IndexSource,
): { chunks: PageChunk[]; compressionApplied: CompressionType } {
  const hits = query(tabId, q, source);
  const chunks: PageChunk[] = [];
  let tokens = 0;
  for (const hit of hits) {
    const chunkTokens = countTokensHeuristic(hit.sectionText);
    if (tokens + chunkTokens > WEBPAGE_TOKEN_BUDGET) break;
    chunks.push({
      id: hit.id,
      tabId: hit.tabId,
      title: hit.title,
      url: hit.url,
      headingPath: hit.headingPath,
      sectionText: hit.sectionText,
    });
    tokens += chunkTokens;
  }
  return { chunks, compressionApplied: 'topk' };
}

/** Drop the tab's memoized index (never orphan an index — §26.4a). */
function evict(tabId: number): void {
  perTabIndexes.delete(tabId);
}

// ---------------------------------------------------------------------------
// Eviction-together wiring (D-87 / §26.4a)
// ---------------------------------------------------------------------------

let evictionHookUnsubscribe: (() => void) | undefined;

/** Register this builder's evict into the 06-03 cache eviction hook so an
 * extraction eviction always drops the index too. Re-invocable so the test
 * seam can re-establish wiring after PageContentCache.__test__.reset(). */
function wireEvictionHook(): void {
  evictionHookUnsubscribe?.();
  evictionHookUnsubscribe = PageContentCache.onIndexEvicted(evict);
}

// D-87: extraction + index always evicted together.
wireEvictionHook();

// ---------------------------------------------------------------------------
// Test seams — exported only for unit tests (`__test__` ProviderRegistry
// convention). Production code must NOT use these.
// ---------------------------------------------------------------------------

export const __test__ = {
  reset(): void {
    perTabIndexes.clear();
    lazyBuildCount = 0;
    wireEvictionHook();
  },
  get indexCount(): number {
    return perTabIndexes.size;
  },
  get buildCount(): number {
    return lazyBuildCount;
  },
  hasIndex(tabId: number): boolean {
    return perTabIndexes.has(tabId);
  },
};

/** Object-form namespace export for callers (ProviderRegistry precedent). */
export const PageIndexBuilder = {
  getIndex,
  query,
  selectRelevant,
  evict,
  __test__,
};

export { getIndex, query, selectRelevant, evict };