/**
 * PageContext and TabContext type definitions for page extraction.
 *
 * Pure interface exports — no runtime code, no classes, no default exports.
 * Products follow `src/core/navigation/navigationTypes.ts` pattern.
 *
 * ## Persistence Note
 * `html` field should NOT be persisted to chrome.storage.local (quota risk).
 * Persist only `markdown` + metadata fields. Set the safety ceiling at ~100KB
 * per page context entry per D-07.
 */

// ---- PRODUCT_SPEC v0.1 §25.1 base fields ----
export interface PageContext {
  /** Full URL of the extracted page */
  url: string;
  /** Origin (scheme + host + port) e.g. "https://example.com" */
  origin: string;
  /** Hostname only e.g. "example.com" */
  hostname: string;
  /** Document title (<title> element) */
  title: string;
  /**
   * Raw HTML of the extracted article/body.
   * NOT persisted to chrome.storage.local — quota risk per Pitfall 2.
   */
  html?: string;
  /** Extracted content as Markdown (primary persisted field) */
  markdown?: string;
  /** Meta tags: name/property → content mapping */
  meta: Record<string, string>;
  /** Unix epoch (ms) of extraction */
  extractedAt: number;
  /** Phase 8 placeholder for add-on-specific page ID */
  addonId?: string;
  /** Phase 8 placeholder for add-on-specific extracted fields */
  addonFields?: Record<string, unknown>;

  // ---- Phase 7.2 extensions (D-08, D-09, D-10) ----
  /**
   * Currently selected text on the page, if any.
   * Captured at extraction time. ContextOptimizer prioritizes
   * this over page content when present (D-08).
   */
  selectedText?: string;
  /**
   * How the content was extracted.
   * - `readability`: @mozilla/readability article extraction
   * - `visible-content`: DOM visible text fallback
   * - `metadata-only`: only URL/title/meta (e.g. blocked page)
   * - `axdom`: AxDomWalker DOM+ARIA tree extraction (Phase 8.1)
   */
  extractionType: 'readability' | 'visible-content' | 'metadata-only' | 'axdom';
  /**
   * Quality classification of the extraction.
   * - `article`: full article with structure
   * - `generic`: generic page content
   * - `minimal`: truncated/limited extraction (safety ceiling hit)
   * - `tree`: indexed DOM+ARIA tree with interactive elements
   */
  extractionQuality: 'article' | 'generic' | 'minimal' | 'tree';
}

/**
 * Represents a pinned tab with its cached PageContext and metadata.
 *
 * ## Closed Pins (D-13)
 * When a pinned tab is closed, `active` is set to `false` but the
 * entry remains in `workspaceStore.pinnedTabs`. `url` and `title`
 * are preserved for display and reactivation.
 */
export interface TabContext {
  /** Browser tab ID (chrome.tabs.Tab.id) */
  tabId: number;
  /** Browser window ID (chrome.tabs.Tab.windowId) */
  windowId: number;
  /** Cached page context from last extraction */
  page: PageContext;
  /** Unix epoch (ms) when the tab was pinned */
  pinnedAt?: number;
  /** Whether the pinned tab is still open in the browser (D-13) */
  active?: boolean;
  /** URL for matching/reactivating closed pins */
  url?: string;
  /** Title for display when tab is closed */
  title?: string;
}
