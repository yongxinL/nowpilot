/**
 * searchTabsTool — built-in tool for searching across open browser tabs.
 *
 * Two-stage search:
 * 1. Always available, no extraction: match query against tab title/URL
 *    via chrome.tabs.query({}) (no new permission — same as pinTabTool/
 *    getPageContentTool's existing chrome.tabs usage).
 * 2. Content-level: for title/url-matched tabs (or, if none matched, a
 *    small bounded fallback set — avoids extracting every open tab on
 *    every query), read cached PageContext (workspaceStore.pageContextByTab)
 *    or extract on demand (OnDemandExtractor), then rank via a fresh
 *    TabContentSearchIndex.
 *
 * No proactive background crawler — extraction stays on-demand per query,
 * consistent with the privacy-first posture (see PRODUCT_SPEC_v0_1.md §7.7).
 *
 * Pattern: fixture tool pattern (PATTERNS.md §7/§8, mirrors getPageContentTool/pinTabTool)
 */
import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { onDemandExtractor } from '../../../content/OnDemandExtractor';
import { TabContentSearchIndex, type TabSearchDoc } from '../../../search/TabContentSearchIndex';
import { tokenEstimator } from '../../../context/TokenEstimator';

// Bounded fallback candidate pool when nothing matches by title/URL —
// avoids extracting every open tab on every query.
const CONTENT_CANDIDATE_CAP = 10;
const SNIPPET_MAX_TOKENS = 300;

type MatchedBy = 'title' | 'url' | 'content';
const MATCH_PRIORITY: Record<MatchedBy, number> = { title: 0, url: 1, content: 2 };

interface TabSearchResult {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  snippet: string;
  matchedBy: MatchedBy;
}

// Mirrors ContextCompressor's heuristicTruncate pattern (§22.2 per-source budgets).
function truncateSnippet(text: string, maxTokens: number): string {
  if (!text) return '';
  const estimated = tokenEstimator.estimateTokens(text);
  if (estimated <= maxTokens) return text;
  const targetChars = maxTokens * 4;
  if (targetChars >= text.length) return text;
  return text.slice(0, targetChars) + '\n[truncated]';
}

export const searchTabsTool: ToolDefinition = {
  name: 'search-tabs',
  description:
    'Search open browser tabs by title, URL, or page content. Content is read from cache when available, or extracted on demand.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Search query'),
    limit: z.number().int().positive().max(50).optional().describe('Max results (default 10)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    results: z
      .array(
        z.object({
          tabId: z.number(),
          windowId: z.number(),
          title: z.string(),
          url: z.string(),
          snippet: z.string(),
          matchedBy: z.enum(['title', 'url', 'content']),
        }),
      )
      .optional(),
    error: z.string().optional(),
  }),
  category: 'safe',
  requiresPermission: false,

  async execute(input, context) {
    if (context.abortSignal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const { query, limit = 10 } = input as { query: string; limit?: number };
    const q = query.toLowerCase();

    let tabs: chrome.tabs.Tab[];
    try {
      tabs = await chrome.tabs.query({});
    } catch (err) {
      return {
        success: false,
        error: `Could not list tabs: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Stage 1: title/url substring match (always available, no extraction).
    const titleUrlMatches: Array<{ tab: chrome.tabs.Tab; matchedBy: MatchedBy }> = [];
    for (const tab of tabs) {
      if (!tab.id) continue;
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      if (title.includes(q)) {
        titleUrlMatches.push({ tab, matchedBy: 'title' });
      } else if (url.includes(q)) {
        titleUrlMatches.push({ tab, matchedBy: 'url' });
      }
    }

    const candidateTabs =
      titleUrlMatches.length > 0
        ? titleUrlMatches.map((m) => m.tab)
        : tabs.slice(0, CONTENT_CANDIDATE_CAP);

    // Stage 2: content-level — cache first, then on-demand extraction.
    const store = useWorkspaceStore.getState();
    const tabById = new Map<number, chrome.tabs.Tab>();
    const markdownByTabId = new Map<number, string>();

    const extractions = await Promise.all(
      candidateTabs
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
        .map(async (tab) => {
          tabById.set(tab.id, tab);
          const cached = store.pageContextByTab[tab.id]?.page;
          const page = cached ?? (await onDemandExtractor.extractFromTab(tab.id));
          return { tabId: tab.id, markdown: page?.markdown };
        }),
    );
    for (const { tabId, markdown } of extractions) {
      if (markdown) markdownByTabId.set(tabId, markdown);
    }

    const docs: TabSearchDoc[] = Array.from(markdownByTabId.entries()).map(([tabId, markdown]) => ({
      id: String(tabId),
      title: tabById.get(tabId)?.title || '',
      markdown,
    }));
    const contentHits = new TabContentSearchIndex(docs).search(query, limit);

    // Merge: title/url matches first, then content-only hits not already present.
    const resultsByTabId = new Map<number, TabSearchResult>();
    for (const { tab, matchedBy } of titleUrlMatches) {
      if (!tab.id) continue;
      resultsByTabId.set(tab.id, {
        tabId: tab.id,
        windowId: tab.windowId ?? -1,
        title: tab.title || '',
        url: tab.url || '',
        snippet: truncateSnippet(markdownByTabId.get(tab.id) || tab.title || '', SNIPPET_MAX_TOKENS),
        matchedBy,
      });
    }
    for (const hit of contentHits) {
      const tabId = Number(hit.id);
      if (resultsByTabId.has(tabId)) continue;
      const tab = tabById.get(tabId);
      if (!tab) continue;
      resultsByTabId.set(tabId, {
        tabId,
        windowId: tab.windowId ?? -1,
        title: tab.title || '',
        url: tab.url || '',
        snippet: truncateSnippet(markdownByTabId.get(tabId) || '', SNIPPET_MAX_TOKENS),
        matchedBy: 'content',
      });
    }

    const results = Array.from(resultsByTabId.values())
      .sort((a, b) => MATCH_PRIORITY[a.matchedBy] - MATCH_PRIORITY[b.matchedBy])
      .slice(0, limit);

    return { success: true, results };
  },
};
