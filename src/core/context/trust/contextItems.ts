// contextItems — D-93/D-94 item-pipeline builder (CTX-01 metadata contract).
//
// buildContextItems(input) converts the §2.3 sources into the C.1 ContextItem[]
// intermediate the trust policy operates on (D-93): every sourced section's
// content is tagged with trust/instructionAuthority/relevance/freshness/
// sensitivity/sourceId per the LOCKED D-94 trust map (spec 4879-4891):
//   [TOOL SCHEMAS]                     trust:'system'     authority:true
//   [USER PREFERENCES]/[USER INPUT]    trust:'user'       authority:true
//   [MEMORY]                           trust:'retrieved'  authority:false
//   [CONTEXT] (Phase-6 pageContext)    trust:'untrusted'  authority:false
//
// sourceId mirrors the locked sourceIdFor switch (ContextOptimizer.ts:349-360):
// CONTEXT → pageContext.url ?? 'context'; MEMORY → hint ids joined ','; TOOL
// SCHEMAS → name-sorted tool names joined ','; USER PREFERENCES → 'preferences';
// USER INPUT → 'user_input'. Deterministic metadata: MEMORY relevance = mean of
// hint.score (2dp), freshness 0.5; all others relevance 1 / freshness 1;
// sensitivity 'high' for CONTEXT+MEMORY, 'low' for USER INPUT, 'none' for
// USER PREFERENCES+TOOL SCHEMAS. Every item carries all five C.1 metadata
// fields (CTX-01). No SYSTEM/TASK items — those kinds have no §2.3 input
// source (manifest omission records, Q3).
//
// The item text/tokens match the section text the assemble pipeline builds for
// that kind (same per-source text builders) so Task-2's section packing stays
// byte-identical to Phase 5 (D-72) and item.text seeds the section text.
import type { ContextItem } from '@/types/harness';
import type { ContextOptimizerInput } from '../ContextOptimizer';
import type { PageContext, RetrievedMemory, ToolSchemaRef } from '../types';
import type { UserPreferences } from '../../ai/UserPreferences';
import { countTokensHeuristic } from '../TokenBudget';

/** D-94 item builder — the five sourced items (no SYSTEM/TASK; CONTEXT emitted
 * always, sourceId falls back to 'context' when no pageContext — the locked
 * sourceIdFor fallback). */
export function buildContextItems(input: ContextOptimizerInput): ContextItem[] {
  const items: ContextItem[] = [];

  // [TOOL SCHEMAS] — system-trusted (tool schemas are system policy, D-94).
  const toolText = buildToolSchemasText(input.selectedToolSchemas);
  const toolSourceId = toolNamesSorted(input.selectedToolSchemas).join(',');
  items.push({
    id: `TOOL SCHEMAS:${toolSourceId}`,
    kind: 'TOOL SCHEMAS',
    text: toolText,
    tokens: countTokensHeuristic(toolText),
    trust: 'system',
    instructionAuthority: true,
    relevance: 1,
    freshness: 1,
    sensitivity: 'none',
    sourceId: toolSourceId,
  });

  // [USER PREFERENCES] — user-trusted (D-94).
  const prefsText = prefsCompact(input.preferences);
  items.push({
    id: 'USER PREFERENCES:preferences',
    kind: 'USER PREFERENCES',
    text: prefsText,
    tokens: countTokensHeuristic(prefsText),
    trust: 'user',
    instructionAuthority: true,
    relevance: 1,
    freshness: 1,
    sensitivity: 'none',
    sourceId: 'preferences',
  });

  // [MEMORY] — retrieved page/note-derived content (D-94): trust 'retrieved',
  // authority false, relevance = mean hint.score (2dp), freshness 0.5.
  const memoryText = input.memoryHints
    .map((hint) => `${hint.id}\t${hint.content}`)
    .join('\n');
  const memorySourceId = input.memoryHints.map((hint) => hint.id).join(',');
  const meanScore =
    input.memoryHints.length === 0
      ? 0
      : Math.round(
          (input.memoryHints.reduce((sum, hint) => sum + hint.score, 0) /
            input.memoryHints.length) *
            100,
        ) / 100;
  items.push({
    id: `MEMORY:${memorySourceId}`,
    kind: 'MEMORY',
    text: memoryText,
    tokens: countTokensHeuristic(memoryText),
    trust: 'retrieved',
    instructionAuthority: false,
    relevance: meanScore,
    freshness: 0.5,
    sensitivity: 'high',
    sourceId: memorySourceId,
  });

  // [CONTEXT] — Phase-6 pageContext output, untrusted raw extraction (D-94).
  // sourceId falls back to 'context' (the locked sourceIdFor fallback); when no
  // pageContext is present the item text is empty and assemble gates the
  // section emission on input.pageContext.
  const contextText = input.pageContext ? buildContextText(input.pageContext) : '';
  const contextSourceId = input.pageContext ? input.pageContext.url : 'context';
  items.push({
    id: `CONTEXT:${contextSourceId}`,
    kind: 'CONTEXT',
    text: contextText,
    tokens: countTokensHeuristic(contextText),
    trust: 'untrusted',
    instructionAuthority: false,
    relevance: 1,
    freshness: 1,
    sensitivity: 'high',
    sourceId: contextSourceId,
  });

  // [USER INPUT] — the current turn, user-trusted (D-94).
  const userText = input.userInput;
  items.push({
    id: 'USER INPUT:user_input',
    kind: 'USER INPUT',
    text: userText,
    tokens: countTokensHeuristic(userText),
    trust: 'user',
    instructionAuthority: true,
    relevance: 1,
    freshness: 1,
    sensitivity: 'low',
    sourceId: 'user_input',
  });

  return items;
}

/** [TOOL SCHEMAS] text: one '<name>\t<description>' line per tool, name-sorted
 * (mirrors ContextOptimizer.buildToolSchemasText). */
function buildToolSchemasText(tools: ToolSchemaRef[]): string {
  if (tools.length === 0) return 'No tools are registered for this session.';
  return [...tools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((tool) => `${tool.name}\t${tool.description}`)
    .join('\n');
}

/** [USER PREFERENCES] compact rendering (mirrors ContextOptimizer.prefsCompact). */
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

/** [CONTEXT] text: 'URL: <url>\nTITLE: <title>\n<body>' (mirrors
 * ContextOptimizer.buildContextText). */
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