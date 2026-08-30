// ContextOptimizer — §2.3 contract + §2.4 degradation ladder (the phase's spine).
//
// assemble(ContextOptimizerInput) is a PURE synchronous function returning the
// AssembleResult discriminated union — never a throw. It walks: tier
// classification (§2.1) → budget computation (§2.2) → per-section token
// counting (D-71 heuristic) → §2.4 stepwise degradation against inputBudget →
// §1.3 canonical packing (ContextPack order) → §2.6 provenance manifest (D-77) →
// OptimizedContext with the derived trace surface. The terminal guarantee: an
// ok:true context never exceeds inputBudget (roadmap SC#2 / §19.3) — if still
// over after minimal mode, assemble RETURNS the typed CONTEXT_TOO_LARGE variant
// (spec 502), whose 'CONTEXT_TOO_LARGE' literal is a canonical §21.6 closed-set
// member (spec 3435/5079): StreamErrorCodeSchema is untouched (D-38).
//
// D-72: PromptSection is re-exported from src/core/ai/types (the A8 single
// source of truth) — PromptCacheAdapter's spec import-target note (lines 6-7)
// resolves without editing any Phase-3 file. The only other Phase-3 contact is
// the type-only UserPreferences import (the verbatim §2.3 input field).
//
// D-69: this module is NOT wired into the live pipeline this phase — zero
// imports of src/core/context/* from src/components or src/core/ai/*.
export type { PromptSection } from '../ai/types';
import type { PromptSection } from '../ai/types';

import type { UserPreferences } from '../ai/UserPreferences';
import type { ContextProvenanceManifest, ManifestKind, ManifestSectionRecord } from './ContextProvenanceManifest';
import { buildManifest, MANIFEST_KIND_MAP } from './ContextProvenanceManifest';
import {
  compressStructural,
  reduceTopK,
  summarizeHistory,
  trimToolSchemas,
} from './ContextCompressor';
import { computeBudgets, countTokensHeuristic } from './TokenBudget';
import { classifyModelContext, type ModelContextTier } from './ModelContextTier';
import type { CompressionType, PageContext, RetrievedMemory, ToolSchemaRef } from './types';
import { applyTrustPolicy } from './trust/TrustPolicy';
import { buildContextItems } from './trust/contextItems';
import { deriveContextReceipt, type ContextReceiptSurface } from './trust/ContextReceipt';
import { deriveContextQualityMetrics, type ContextQualityMetrics } from './trust/ContextQualityMetrics';
import type { ContextItem } from '@/types/harness';

/** §2.3 input contract verbatim (spec 466-478). workspaceId/activeSurface are
 * REQUIRED with no defaults (Q6 LOCKED — empty-string defaults would poison the
 * manifest's provenance records, Assumption A5). */
export interface ContextOptimizerInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'standalone';
  pageContext?: PageContext;
  selectedToolSchemas: ToolSchemaRef[];
  memoryHints: RetrievedMemory[];
  preferences: UserPreferences;
  // --- D-97 additive inputs (§2.4 rungs 1-2 caller seams, spec 495-496) ---
  // When supplied, additional CONTEXT-kind sections (sourceId 'debug'/'notes')
  // are assembled and dropped by the ladder when over budget. Absent → the
  // rungs stay no-ops (spec 495-496 preserved). Additive — existing callers
  // compile unchanged.
  debugSections?: string[];
  secondaryNotes?: string[];
}

/** §2.3 output contract verbatim (spec 479-486) PLUS the additive D-77 trace
 * surface. contextTier mirrors tier — the Phase-11 PromptTrace field name
 * (spec 744); the redundancy is documented so Phase 11 lifts the trace
 * additively. truncatedSources derives from the manifest's truncated sections
 * (excluding the by-design 'system'/'task' omission records, Q3). */
export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
  // --- D-77 trace surface (Phase 11 lifts into PromptTrace) ---
  contextTier: ModelContextTier;
  truncated: boolean;
  truncatedSources: string[];
  // --- D-95 receipt surface (CTX-03; additive — the D-77 precedent) ---
  // Derived from the verbatim manifest + D-96 original token counts + A8
  // stable flags + item trust; Phase 11 Prompt Inspector lifts it additively.
  receipt: ContextReceiptSurface;
  // --- D-102 metrics surface (CTX-06; additive — the D-77 precedent) ---
  // Derived aggregate metrics (section count, trust mix, truncation/omission/
  // compression counts, token utilization ratio, minimalMode) — aggregates
  // ONLY, no raw section text (UI-SPEC Contract B); Phase 11 lifts it
  // additively into PromptTrace/DiagnosticsSection.
  metrics: ContextQualityMetrics;
}

/** §2.5 blocked set verbatim (spec 519-524) — kebab-case literals (D-74). */
export type BlockedFeature =
  | 'multi-step-agent'
  | 'mcp-chaining'
  | 'code-search-skill'
  | 'full-note-graph-injection'
  | 'large-research-synthesis'
  | 'llm-wiki-bulk'
  | 'llm-wiki-rag';

/** §2.5 blocked set, verbatim (spec 519-524). */
export const BLOCKED_IN_MINIMAL_MODE: readonly BlockedFeature[] = [
  'multi-step-agent',
  'mcp-chaining',
  'code-search-skill',
  'full-note-graph-injection',
  'large-research-synthesis',
  'llm-wiki-bulk',
  'llm-wiki-rag',
];

/** §2.5/D-74 minimal-mode gate: NOT blocked → allowed; unknown features default
 * to ALLOWED (closed-set discipline). */
export function isFeatureAllowedInMinimalMode(feature: string): boolean {
  return !(BLOCKED_IN_MINIMAL_MODE as readonly string[]).includes(feature);
}

/** Q4 LOCKED — returned discriminated union, never a throw (§2.4 spec 502;
 * 'CONTEXT_TOO_LARGE' is a canonical §21.6 literal, spec 3435/5079 — D-38). */
export type AssembleResult =
  | { ok: true; context: OptimizedContext }
  | {
      ok: false;
      code: 'CONTEXT_TOO_LARGE';
      message: string;
      totalTokens: number;
      inputBudget: number;
      minimalMode: boolean;
      truncatedSources: string[];
    };

/** One shipped section + its §2.6 provenance record, kept in lockstep. */
interface WorkingSection {
  section: PromptSection;
  record: ManifestSectionRecord;
  // NEW (D-96): pre-degradation token count, captured in buildSourcedSections.
  originalTokens: number;
  // NEW (D-97): rungs 1-2 drop debug/notes — the record stays in the manifest
  // (truncated:true) but the section is excluded from the output.
  dropped?: boolean;
}

/**
 * assemble — the pure end-to-end context spine (D-69/D-73).
 *
 * Step sequence: (1) tier = classifyModelContext; (2) budgets =
 * computeBudgets; (3) minimalMode = tier === 'tiny' (mandatory, spec 506);
 * (4) build the five sourced sections in §1.3 canonical order; (5) estimate
 * each section's tokens via heuristicTokenCounter; (6) if totalTokens exceeds
 * inputBudget, walk the §2.4 degradation ladder, re-tallying after every rung;
 * (7) attach the §2.6 manifest and derive the trace surface. Never a throw:
 * overflow past minimal mode returns the CONTEXT_TOO_LARGE variant.
 */
export function assemble(input: ContextOptimizerInput): AssembleResult {
  const tier = classifyModelContext(input.modelContextWindow);
  const budgets = computeBudgets(input.modelContextWindow);
  let minimalMode = tier === 'tiny';

  // D-93: buildSourcedSections runs the item pipeline — sources → ContextItem[]
  // (D-94 tags) → non-throwing applyTrustPolicy → (possibly wrapped) section
  // text — and retains the D-96 original per-section token counts.
  const built = buildSourcedSections(input);
  let working = built.working;
  const originalTokensBySourceId = built.originalTokensBySourceId;
  const items = built.items;
  let totalTokens = tally(working);

  if (totalTokens > budgets.inputBudget) {
    const ladder = applyDegradationLadder(
      working,
      budgets.inputBudget,
      input.pageContext,
      toolNamesSorted(input.selectedToolSchemas),
      input.memoryHints.length,
      minimalMode,
    );
    totalTokens = ladder.totalTokens;
    minimalMode = ladder.minimalMode;
    if (totalTokens > budgets.inputBudget) {
      return tooLargeResult(working, budgets.inputBudget, minimalMode, input);
    }
  }

  const manifest = buildManifest({
    sectionRecords: working.map((w) => w.record),
    totalTokens,
    minimalMode,
    workspaceId: input.workspaceId,
    activeSurface: input.activeSurface,
  });
  const truncatedSources = manifestTruncatedSources(manifest);

  // D-95: derive the receipt from the verbatim manifest + retained original
  // token counts + the shipped sections + the item trust mix (CTX-03; the L6
  // untrustedDataPresent signal, UI-SPEC Contract A). Never throws.
  const receipt = deriveContextReceipt(
    manifest,
    originalTokensBySourceId,
    working.filter((w) => !w.dropped).map((w) => w.section),
    items,
  );

  // D-102: derive the CTX-06 aggregate metrics from the verbatim manifest + the
  // derived receipt + the item trust mix (aggregates ONLY — no section bodies,
  // UI-SPEC Contract B). Never throws; additive like the receipt (D-77).
  const metrics = deriveContextQualityMetrics(manifest, receipt, items);

  const context: OptimizedContext = {
    tier,
    inputBudget: budgets.inputBudget,
    outputBudget: budgets.outputBudget,
    sections: working.filter((w) => !w.dropped).map((w) => w.section),
    provenance: manifest,
    minimalMode,
    contextTier: tier,
    truncated: truncatedSources.length > 0,
    truncatedSources,
    receipt,
    metrics,
  };
  return { ok: true, context };
}

/**
 * §2.4 degradation ladder (spec 491-502) in EXACT order (D-73). Mutates
 * `working` in place (section + provenance record), re-tallying after every
 * rung; stops as soon as totalTokens ≤ inputBudget. Returns the final tally and
 * minimalMode (rung 7 flips it for non-tiny tiers; tiny is already minimal).
 */
function applyDegradationLadder(
  working: WorkingSection[],
  inputBudget: number,
  pageContext: PageContext | undefined,
  initialToolNames: string[],
  memoryHintCount: number,
  initialMinimalMode: boolean,
): { totalTokens: number; minimalMode: boolean } {
  let totalTokens = tally(working);
  let minimalMode = initialMinimalMode;

  // Rung 1 — 'drop debug-only context' (spec 495). Phase-7 activation (D-97):
  // when the caller supplied debugSections (a sourceId-'debug' CONTEXT section
  // is present), drop it with a truncated manifest record. When absent, the
  // rung stays a no-op (spec 495-496 preserved).
  if (totalTokens > inputBudget) {
    const debug = working.find((w) => w.record.sourceId === 'debug');
    if (debug) {
      dropSection(working, debug);
      totalTokens = tally(working);
    }
  }

  // Rung 2 — 'drop secondary notes and optional metadata' (spec 496). Same
  // activation for sourceId-'notes'.
  if (totalTokens > inputBudget) {
    const notes = working.find((w) => w.record.sourceId === 'notes');
    if (notes) {
      dropSection(working, notes);
      totalTokens = tally(working);
    }
  }

  // Rung 3 — 'summarise older history' (spec 497). Phase 5's [CONTEXT] has no
  // history turns ('TURN ' lines) — the §2.3 input has no history source — so
  // this no-ops; the seam + drop-not-silence fallback are unit-tested in 05-02.
  const history = summarizeHistory(
    working.map((w) => w.section),
    undefined, // D-75: Phase 5 never calls the LLM
  );
  if (history.truncated) {
    applySections(working, history.sections);
    markRecord(working, 'context', 'summarise');
    totalTokens = tally(working);
  }

  // Rung 4 — 'compress page/case context into structured fields' (spec 498).
  if (totalTokens > inputBudget && pageContext) {
    const current = findSection(working, 'CONTEXT');
    if (current) {
      const compressed = compressStructural(current);
      if (compressed.text !== current.text) {
        replaceSection(working, compressed);
        markRecord(working, 'context', 'structural');
        totalTokens = tally(working);
      }
    }
  }

  // Rung 5 — 'trim tool schemas to the tools currently in scope' (spec 499).
  // Halving each pass: keep the first ceil(n/2) name-sorted entries, minimum 1
  // ('in scope' in Phase 5 = the caller's selected schemas).
  let inScopeTools = initialToolNames;
  while (totalTokens > inputBudget && inScopeTools.length > 0) {
    const keep = Math.max(1, Math.ceil(inScopeTools.length / 2));
    if (keep >= inScopeTools.length) break; // cannot shrink further
    inScopeTools = inScopeTools.slice(0, keep);
    const before = totalTokens;
    applySections(working, trimToolSchemas(working.map((w) => w.section), inScopeTools));
    markRecord(working, 'tool_schemas');
    totalTokens = tally(working);
    if (totalTokens >= before) break; // no progress → advance to the next rung
  }

  // Rung 6 — 'reduce memory injection top-k' (spec 500). Halving k each pass,
  // minimum 1.
  let memoryK = memoryHintCount;
  while (totalTokens > inputBudget && memoryK > 1) {
    const nextK = Math.max(1, Math.ceil(memoryK / 2));
    if (nextK >= memoryK) break;
    memoryK = nextK;
    const before = totalTokens;
    applySections(working, reduceTopK(working.map((w) => w.section), memoryK));
    markRecord(working, 'memory', 'topk');
    totalTokens = tally(working);
    if (totalTokens >= before) break;
  }

  // Rung 7 — 'enter minimal mode' (spec 501). Phase 5 ships the flag + the
  // §2.5/D-74 predicate; the allowed-list content reductions are the flag's
  // consumer-side semantics (rungs 5/6 already applied the tool/memory cuts).
  if (totalTokens > inputBudget) {
    minimalMode = true;
  }

  return { totalTokens, minimalMode };
}

/** buildSourcedSections result — the working set + the D-93 item array + the
 * D-96 original per-section token counts keyed by sourceId (receipt input). */
interface BuiltSections {
  working: WorkingSection[];
  items: ContextItem[];
  originalTokensBySourceId: Record<string, number>;
}

/**
 * Builds the sourced sections, emitted in §1.3 canonical order
 * (CANONICAL_SECTION_ORDER drives the emit — ContextPack traversal; never
 * alphabetical, Pitfall 4). [SYSTEM]/[TASK] have no input source in the §2.3
 * verbatim contract and are recorded as omitted in the manifest (Q3 LOCKED).
 *
 * D-93: every section runs through the item pipeline — buildContextItems
 * (D-94 tags) → applyTrustPolicy (NON-throwing) — and the (possibly wrapped)
 * item text seeds the section text. D-96: originalTokens captured per section
 * before any degradation. D-97: optional debugSections/secondaryNotes ride
 * additional CONTEXT-kind sections (sourceId 'debug'/'notes').
 */
function buildSourcedSections(input: ContextOptimizerInput): BuiltSections {
  // D-93 item pipeline: the five sourced items, D-94-tagged.
  const items: ContextItem[] = [...buildContextItems(input)];

  // D-97 rungs 1-2 caller seams: optional debug/notes ride additional
  // CONTEXT-kind sections (sourceId 'debug'/'notes' — RESEARCH Open Q2; pack()
  // still sees only canonical kinds).
  const debugText = input.debugSections?.join('\n\n');
  if (debugText) {
    items.push(extraContextItem('debug', debugText));
  }
  const notesText = input.secondaryNotes?.join('\n\n');
  if (notesText) {
    items.push(extraContextItem('notes', notesText));
  }

  // Non-throwing policy (RESEARCH Pitfall 2 — assemble never throws).
  const policyItems = applyTrustPolicy(items);

  // The CONTEXT section ships only when a real pageContext exists (Phase-5
  // gate); the sourceId-fallback 'context' phantom item is dropped here.
  const shippedItems = policyItems.filter(
    (it) => !(it.sourceId === 'context' && input.pageContext === undefined),
  );

  const working: WorkingSection[] = [];
  const originalTokensBySourceId: Record<string, number> = {};
  for (const it of shippedItems) {
    // Stable flag mirrors the §1.3 cache contract: only [TOOL SCHEMAS] is
    // cache-eligible in the Phase-5 emission (USER PREFERENCES stays
    // stable:false — RESEARCH reconciliation 3).
    const section: PromptSection = {
      kind: it.kind,
      text: it.text,
      stable: it.kind === 'TOOL SCHEMAS',
      tokens: it.tokens,
    };
    originalTokensBySourceId[it.sourceId] = it.tokens;
    working.push({
      section,
      record: {
        kind: MANIFEST_KIND_MAP[it.kind],
        sourceId: it.sourceId,
        tokens: it.tokens,
        truncated: false,
      },
      originalTokens: it.tokens,
    });
  }
  return { working, items: shippedItems, originalTokensBySourceId };
}

/** D-97 extra CONTEXT-kind item for debug/notes inputs — untrusted, authority
 * false (page-derived content, D-94 semantics), sensitivity 'high'. */
function extraContextItem(sourceId: string, text: string): ContextItem {
  return {
    id: `CONTEXT:${sourceId}`,
    kind: 'CONTEXT',
    text,
    tokens: countTokensHeuristic(text),
    trust: 'untrusted',
    instructionAuthority: false,
    relevance: 1,
    freshness: 1,
    sensitivity: 'high',
    sourceId,
  };
}

/** Name-sorted tool names (the §2.6 sourceId join + rung 5's in-scope list). */
function toolNamesSorted(tools: ToolSchemaRef[]): string[] {
  return tools.map((tool) => tool.name).sort((a, b) => a.localeCompare(b));
}

function tally(working: WorkingSection[]): number {
  return working.reduce((sum, w) => sum + w.section.tokens, 0);
}

function findSection(working: WorkingSection[], kind: string): PromptSection | undefined {
  return working.find((w) => w.section.kind === kind)?.section;
}

/** Zips a replacement sections array (parallel to working, map-order preserved)
 * back into the working set, syncing record tokens. */
function applySections(working: WorkingSection[], sections: PromptSection[]): void {
  for (let i = 0; i < working.length && i < sections.length; i++) {
    working[i].section = sections[i];
    working[i].record.tokens = sections[i].tokens;
  }
}

function replaceSection(working: WorkingSection[], section: PromptSection): void {
  const w = working.find((entry) => entry.section.kind === section.kind);
  if (!w) return;
  w.section = section;
  w.record.tokens = section.tokens;
}

/** Rungs 1-2 (D-97): drop a debug/notes section — the manifest record stays
 * (truncated:true, tokens:0, the truncated manifest record the receipt maps to
 * omitReason) but the section is excluded from the output. */
function dropSection(working: WorkingSection[], target: WorkingSection): void {
  target.dropped = true;
  target.section = { ...target.section, text: '', tokens: 0 };
  target.record = { ...target.record, tokens: 0, truncated: true };
}

/** Marks the provenance record of a degraded section: truncated, plus the
 * compression type where the §2.6 union has one (rungs 3/4/6). */
function markRecord(
  working: WorkingSection[],
  kind: ManifestKind,
  compressionApplied?: CompressionType,
): void {
  const w = working.find((entry) => entry.record.kind === kind);
  if (!w) return;
  w.record.truncated = true;
  if (compressionApplied !== undefined) w.record.compressionApplied = compressionApplied;
}

/** truncatedSources = manifest truncated section sourceIds, EXCLUDING the
 * by-design 'system'/'task' omission records (Q3) — sourceIds only, never
 * section text (T-05-03 / TraceRedactor discipline). */
function manifestTruncatedSources(manifest: ContextProvenanceManifest): string[] {
  return manifest.sections
    .filter((s) => s.truncated && s.sourceId !== 'system' && s.sourceId !== 'task')
    .map((s) => s.sourceId);
}

/** Terminal: the typed CONTEXT_TOO_LARGE variant — a user-facing explanation
 * naming budgets only, never raw content (T-05-03). */
function tooLargeResult(
  working: WorkingSection[],
  inputBudget: number,
  minimalMode: boolean,
  input: ContextOptimizerInput,
): AssembleResult {
  const totalTokens = tally(working);
  const manifest = buildManifest({
    sectionRecords: working.map((w) => w.record),
    totalTokens,
    minimalMode,
    workspaceId: input.workspaceId,
    activeSurface: input.activeSurface,
  });
  return {
    ok: false,
    code: 'CONTEXT_TOO_LARGE',
    message: `The assembled context (${totalTokens} tokens) exceeds the ${inputBudget}-token input budget for this model window. Retry with a shorter page, fewer tools, or less injected memory.`,
    totalTokens,
    inputBudget,
    minimalMode,
    truncatedSources: manifestTruncatedSources(manifest),
  };
}