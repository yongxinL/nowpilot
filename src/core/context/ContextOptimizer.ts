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
import { CANONICAL_SECTION_ORDER } from './ContextPack';
import {
  compressStructural,
  reduceTopK,
  summarizeHistory,
  trimToolSchemas,
} from './ContextCompressor';
import { computeBudgets, heuristicTokenCounter } from './TokenBudget';
import { classifyModelContext, type ModelContextTier } from './ModelContextTier';
import type { CompressionType, PageContext, RetrievedMemory, ToolSchemaRef } from './types';

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

  const working = buildSourcedSections(input);
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

  const context: OptimizedContext = {
    tier,
    inputBudget: budgets.inputBudget,
    outputBudget: budgets.outputBudget,
    sections: working.map((w) => w.section),
    provenance: manifest,
    minimalMode,
    contextTier: tier,
    truncated: truncatedSources.length > 0,
    truncatedSources,
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

  // Rung 1 — 'drop debug-only context' (spec 495). RESERVED no-op: the §2.3
  // verbatim input has no debug source; the Phase-7 caller supplies debug
  // sections and this rung drops them here.
  // Rung 2 — 'drop secondary notes and optional metadata' (spec 496). RESERVED
  // no-op: no notes source in the §2.3 input; Phase-7 caller.
  // Both rungs exist so the §2.4 order is walkable verbatim.

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

/** Builds the five sourced sections, emitted in §1.3 canonical order
 * (CANONICAL_SECTION_ORDER drives the emit — ContextPack traversal; never
 * alphabetical, Pitfall 4). [SYSTEM]/[TASK] have no input source in the §2.3
 * verbatim contract and are recorded as omitted in the manifest (Q3 LOCKED). */
function buildSourcedSections(input: ContextOptimizerInput): WorkingSection[] {
  const byKind = new Map<string, PromptSection>();

  // [TOOL SCHEMAS] — cache-eligible (§1.3): one '<name>\t<description>' line
  // per tool, name-sorted (stable tool-name sort, §1.3).
  const toolSchemasText = buildToolSchemasText(input.selectedToolSchemas);
  byKind.set('TOOL SCHEMAS', {
    kind: 'TOOL SCHEMAS',
    text: toolSchemasText,
    stable: true,
    tokens: heuristicTokenCounter.count(toolSchemasText),
  });

  // [USER PREFERENCES] — compact rendering mirroring PromptCacheManager's
  // prefsCompact style (§1.3 [USER PREFERENCES: compact]).
  const prefsText = prefsCompact(input.preferences);
  byKind.set('USER PREFERENCES', {
    kind: 'USER PREFERENCES',
    text: prefsText,
    stable: false,
    tokens: heuristicTokenCounter.count(prefsText),
  });

  // [MEMORY] — one '<id>\t<content>' line per hint (all hints initially).
  const memoryText = input.memoryHints.map((hint) => `${hint.id}\t${hint.content}`).join('\n');
  byKind.set('MEMORY', {
    kind: 'MEMORY',
    text: memoryText,
    stable: false,
    tokens: heuristicTokenCounter.count(memoryText),
  });

  // [CONTEXT] — page/case content when present (stable:false).
  if (input.pageContext) {
    const contextText = buildContextText(input.pageContext);
    byKind.set('CONTEXT', {
      kind: 'CONTEXT',
      text: contextText,
      stable: false,
      tokens: heuristicTokenCounter.count(contextText),
    });
  }

  // [USER INPUT] — current turn, never cached (§1.3).
  const userText = input.userInput;
  byKind.set('USER INPUT', {
    kind: 'USER INPUT',
    text: userText,
    stable: false,
    tokens: heuristicTokenCounter.count(userText),
  });

  const working: WorkingSection[] = [];
  for (const kind of CANONICAL_SECTION_ORDER) {
    const section = byKind.get(kind);
    if (!section) continue;
    const manifestKind = MANIFEST_KIND_MAP[kind];
    working.push({
      section,
      record: {
        kind: manifestKind,
        sourceId: manifestKind,
        tokens: section.tokens,
        truncated: false,
      },
    });
  }
  return working;
}

/** [TOOL SCHEMAS] text: one '<name>\t<description>' line per tool, name-sorted. */
function buildToolSchemasText(tools: ToolSchemaRef[]): string {
  if (tools.length === 0) return 'No tools are registered for this session.';
  return [...tools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((tool) => `${tool.name}\t${tool.description}`)
    .join('\n');
}

/** [USER PREFERENCES] compact rendering — mirrors PromptCacheManager.prefsCompact. */
function prefsCompact(prefs: UserPreferences): string {
  const parts: string[] = [];
  if (prefs.fastModel) parts.push(`fastModel: ${prefs.fastModel}`);
  if (prefs.balancedModel) parts.push(`balancedModel: ${prefs.balancedModel}`);
  const overrides = prefs.personaOverrides;
  if (overrides?.name) parts.push(`persona name: ${overrides.name}`);
  if (overrides?.tone) parts.push(`tone: ${overrides.tone}`);
  if (overrides?.brevity) parts.push(`brevity: ${overrides.brevity}`);
  return parts.length === 0 ? 'Default persona; no user preferences set.' : parts.join('\n');
}

/** [CONTEXT] text: 'URL: <url>\nTITLE: <title>\n<body>' — body from markdown ??
 * html-stripped ?? title (Phase 6 owns the real extraction). */
function buildContextText(page: PageContext): string {
  const body = page.markdown ?? stripHtml(page.html) ?? page.title;
  return `URL: ${page.url}\nTITLE: ${page.title}\n${body}`;
}

/** Minimal HTML stripping — enough for a readable token estimate. */
function stripHtml(html: string | undefined): string | undefined {
  if (html === undefined) return undefined;
  const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped === '' ? undefined : stripped;
}

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