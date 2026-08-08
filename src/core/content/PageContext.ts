// src/core/content/PageContext.ts — Source: Appendix C (verbatim, lines 4317-4334)
// Canonical home per R-1 (Golden Rule 2: never relocate these types).
// Phase 1 ships the types only — extraction begins in Phase 4a (D-16).
export interface PageContext {
  url: string;
  origin: string;
  hostname: string;
  title: string;
  html?: string;
  markdown?: string;
  meta: Record<string, string>;
  extractedAt: number;
  addonId?: string;
  addonFields?: Record<string, unknown>;
}
export interface TabContext {
  tabId: number;
  windowId: number;
  page: PageContext;
  pinnedAt?: number;
}
