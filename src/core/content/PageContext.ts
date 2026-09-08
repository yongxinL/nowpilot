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
