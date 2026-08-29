// Minimal input shapes for the Phase 5 context layer (plan 05-01, Task 1) +
// the shared strategy types ContextOptimizer/ContextCompressor depend on.
//
// D-83 supersession (Phase 6): PageContext/TabContext/SNowCaseData/FileContext/
// NoteContext now live canonically at src/core/content/PageContext.ts (spec
// 4345) and are re-exported from here — ContextOptimizer's `import type {
// PageContext } from './types'` keeps resolving (D-72 re-export precedent; no
// parallel copy).
//
// Remaining SUPERSESSION POINTS — minimal local declarations whose canonical
// homes live in later owning phases (the Phase-3 UserPreferences precedent at
// src/core/ai/UserPreferences.ts:1-6):
//   - RetrievedMemory → Phase 8 replaces at src/core/memory/types.ts (spec 4571)
//   - ToolSchemaRef   → Phase 18 owns the real registry type at src/core/ai/toolSchemas.ts (spec 4600)
//
// The shapes are declared verbatim from PRODUCT_SPEC_v0_1.md Appendix C
// (spec 4572-4578, 4601-4607). They are plain TS interfaces — the owning
// phases ship the zod versions. Phase 5 is create-only (D-69): it must not
// edit those owning files.
import type { PromptSection } from '../ai/types';

/** D-83: PageContext family re-exported from the canonical Phase-6 home (spec 4345-4391). */
export type { PageContext, TabContext, SNowCaseData, FileContext, NoteContext } from '../content/PageContext';

/** RetrievedMemory supersession point — Phase 8 owns src/core/memory/types.ts (spec 4572-4578). */
export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}

/** ToolSchemaRef supersession point — Phase 18 owns the registry type (spec 4601-4607). */
export interface ToolSchemaRef {
  name: string;
  description: string;
  jsonSchema: unknown;
  dangerous: boolean;
  source: 'builtin' | 'mcp' | 'skill' | 'servicenow';
}

/** §2.6 compressionApplied union (spec 537) — recorded per section in the manifest. */
export type CompressionType = 'summarise' | 'structural' | 'topk';

/**
 * D-75 summariser seam — declare-now/populate-later (D-46/D-64 precedent).
 * Phase 5 never calls the LLM; a consumer-owned LLM-backed summariser plugs in
 * later. When absent, history truncation falls back to dropping older turns
 * (recorded as truncation, never silence).
 */
export interface Summarizer {
  summarize(sections: PromptSection[]): { text: string; tokens: number };
}