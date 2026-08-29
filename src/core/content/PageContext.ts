// Canonical PageContext family — Phase-6 home (PRODUCT_SPEC_v0_1.md Appendix C,
// spec 4345-4391, verbatim).
//
// Phase-6 canonical home — replaces the Phase-5 placeholder in
// src/core/context/types.ts (spec 4345 / D-83). src/core/context/types.ts
// re-exports these five types so ContextOptimizer's `import type { PageContext }
// from './types'` keeps resolving — no parallel copy (D-72 precedent).
//
// NOTE: the TabContext declared here (Appendix C — { tabId, windowId, page,
// pinnedAt? }) is a DIFFERENT type from WorkspaceStore's local TabContext
// { tabId, title, url, pinned } (the pinnedTabs subscription signal, D-88).
// Do not conflate them; WorkspaceStore is untouched by this phase.

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

export interface SNowCaseData {
  caseId: string;
  number: string;
  shortDescription: string;
  description: string;
  state: string;
  priority: string;
  assignedTo?: string;
  openedAt: number;
  updatedAt: number;
  latestComments: Array<{ author: string; body: string; at: number }>;
  workNotes: Array<{ author: string; body: string; at: number }>;
}

export interface FileContext {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  textPreview?: string;
}

export interface NoteContext {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  score: number;
}