// src/core/extraction/PageIndexBuilder.ts — D-4a-15/16 greenfield: the ephemeral
// per-tab MiniSearch index over heading-chunked Defuddle markdown. NEVER
// persisted (§26.5) — the index is built lazily on first query() (per-tab
// memoization lives in the cache/service layer 04a-08), evicted with the
// extraction, and dropped together with the cache entry (D-4a-04). MiniSearch
// v7 is the approved engine (§7/§26.5, R-9) — never a hand-rolled inverted
// index. Dependency-free core: imports only MiniSearch + the shared token
// counter (estimateTokens — the ONLY token counter, A4/Pitfall 1); no storage,
// no React/antd/zustand.
import MiniSearch from 'minisearch';

import { estimateTokens } from '@/core/context/TokenBudget';

/** D-4a-16 / Appendix C constant — sections over this token budget sub-chunk (exported + vitest-pinned). */
export const INDEX_CHUNK_MAX_TOKENS = 500;

/**
 * D-4a-16 doc shape — fields indexed + stored; idField defaults to 'id'.
 * id is deterministic: `${tabId}:${sectionPath}:${chunkIndex}`.
 */
export interface PageChunk {
  id: string;
  title: string;
  url: string;
  /** Breadcrumb e.g. 'Work KB > ServiceNow > Incident' — '' for the (preamble) chunk. */
  headingPath: string;
  sectionText: string;
}

interface HeadingLine {
  lineIndex: number;
  level: number;
  text: string;
}

const ATX_HEADING_RE = /^(#{1,6})\s+(.*)$/;

/**
 * D-4a-16 heading-boundary chunking:
 * - Heading sections (atx h1-h6) become chunks whose headingPath is the
 *   breadcrumb of the heading hierarchy ('A > B > C').
 * - A synthetic '(preamble)' chunk covers content before the first heading
 *   (no orphaned lead text).
 * - No-heading pages fall back to paragraph-block chunks (blank-line separated)
 *   under the page title.
 * - Sections over INDEX_CHUNK_MAX_TOKENS split into paragraph sub-chunks
 *   inheriting the same headingPath (each sub-chunk stays under the budget).
 */
export function chunkMarkdown(
  markdown: string,
  opts: { title: string; url: string; tabId: number },
): PageChunk[] {
  const { title, url, tabId } = opts;
  const lines = markdown.split('\n');

  const headings: HeadingLine[] = [];
  lines.forEach((line, i) => {
    const m = ATX_HEADING_RE.exec(line);
    if (m) headings.push({ lineIndex: i, level: m[1].length, text: m[2].trim() });
  });

  if (headings.length === 0) {
    // No-heading fallback (D-4a-16): blank-line paragraph blocks under the page title.
    return splitParagraphBlocks(markdown).map((block, chunkIndex) => ({
      id: `${tabId}:${title}:${chunkIndex}`,
      title,
      url,
      headingPath: title,
      sectionText: block,
    }));
  }

  const chunks: PageChunk[] = [];

  // (preamble) — content before the first heading (no orphaned lead text).
  const preambleText = lines.slice(0, headings[0].lineIndex).join('\n').trim();
  if (preambleText.length > 0) {
    chunks.push({ id: `${tabId}:(preamble):0`, title, url, headingPath: '', sectionText: preambleText });
  }

  // Breadcrumb stack (h1 > h2 > h3) — pop siblings/deeper levels per heading level.
  const stack: Array<{ level: number; text: string }> = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop();
    stack.push({ level: h.level, text: h.text });
    const headingPath = stack.map((s) => s.text).join(' > ');

    const sectionStart = h.lineIndex + 1;
    const sectionEnd = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
    const body = lines.slice(sectionStart, sectionEnd).join('\n').trim();
    if (body.length === 0) continue; // empty section — no chunk

    if (estimateTokens(body) > INDEX_CHUNK_MAX_TOKENS) {
      // D-4a-16 sub-chunking: paragraph sub-chunks inheriting the same headingPath.
      splitParagraphBlocks(body).forEach((para, chunkIndex) => {
        chunks.push({ id: `${tabId}:${headingPath}:${chunkIndex}`, title, url, headingPath, sectionText: para });
      });
    } else {
      chunks.push({ id: `${tabId}:${headingPath}:0`, title, url, headingPath, sectionText: body });
    }
  }

  return chunks;
}

/** Blank-line-separated paragraph blocks, trimmed and de-blanked. */
function splitParagraphBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

/**
 * RESEARCH Pattern 5 (MiniSearch v7 API verified): index + store the same four
 * fields; idField defaults to 'id' on PageChunk. Query via
 * `mini.search(query, { prefix: true, boost: { title: 2, headingPath: 1.5 } })`.
 */
export function buildPageIndex(chunks: PageChunk[]): MiniSearch {
  const mini = new MiniSearch<PageChunk>({
    fields: ['title', 'url', 'headingPath', 'sectionText'],
    storeFields: ['title', 'url', 'headingPath', 'sectionText'],
  });
  mini.addAll(chunks);
  return mini;
}
