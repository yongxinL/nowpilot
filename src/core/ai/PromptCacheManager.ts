// PromptCacheManager — the D-59 single choke-point for system-prompt assembly
// (03-PATTERNS.md:225-234, 03-RESEARCH.md Pattern 2 lines 241-270).
//
// §1.3: every AI call in the phase assembles its system prompt through
// buildSystemPrompt — the ONLY call site of PersonaInjector's inject
// function in src/ (grep-assertable: exactly one call under src/). The
// persona block is prepended FIRST inside the cached [SYSTEM] section and
// stays byte-stable per persona so prompt caching is preserved (Pitfall 3).
//
// Prompt-cache invalidation (Open Q5): the cached [SYSTEM] is keyed on the
// profile-version hash = hashStableSections over the persona block — when
// persona overrides change, the hash changes, and the next build emits a new
// byte-stable block. No explicit invalidation API.
//
// §19.13 (spec 3058-3060): after 5 consecutive cache misses the manager
// disables cache hints for 60 s to avoid overhead.
import { PROMPTS } from '../prompts';
import { DEFAULT_PERSONA } from './persona/PersonaProfile';
import {
  buildPersonaBlock,
  resolvePersona,
  PersonaInjector,
  type PipelineStage,
} from './persona/PersonaInjector';
import { hashStableSections } from './PromptCacheAdapter';
import type { UserPreferences } from './UserPreferences';
import type { PromptSection } from './types';

/** §19.13: 5 consecutive cache misses → disable hints for 60 s. */
export const CACHE_DISABLE_MISS_THRESHOLD = 5;
const CACHE_DISABLE_WINDOW_MS = 60_000;

/** Standard chars→tokens heuristic (roughly 4 chars/token) for section budget bookkeeping. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Canonical stage string for 'executor'. Appendix A (03-01 PROMPTS) defines
 * planner/renderer/memoryExtractor but no executor entry — §1.2's
 * ExecutorService is deterministic ("The LLM never executes tools directly")
 * and Phase 3 registers zero tools, so this reserved string is never sent to
 * a model in Phase 3. It stays persona-free and byte-stable (RICH-R-10).
 *
 * TODO(Phase 18 — Tool Governance): the tool-owning phase replaces this
 * local constant with its own canonical Appendix A executor entry before the
 * executor stage ever reaches a model (IN-03 tracked reference).
 */
const EXECUTOR_SYSTEM =
  'You are executing a tool call. Return JSON only: {"toolName": "...", "input": {...}}. Never fabricate tool output.';

function canonicalStageString(stage: PipelineStage): string {
  switch (stage) {
    case 'planner':
      return PROMPTS.planner.system;
    case 'renderer':
      return PROMPTS.renderer.system;
    case 'memoryExtractor':
      return PROMPTS.memoryExtractor.system;
    case 'executor':
      return EXECUTOR_SYSTEM;
  }
}

export interface BuildSystemPromptOptions {
  /** Resolved overrides (np_preferences) — data-merged into the persona. */
  prefs?: UserPreferences;
  /** Custom persona profile (defaults to DEFAULT_PERSONA). */
  persona?: Parameters<typeof resolvePersona>[0];
  /** Registered tool names for the [TOOL SCHEMAS] section (zero in Phase 3). */
  toolNames?: readonly string[];
  /** Small task descriptor for [TASK]. */
  task?: string;
  /** Current turn text for [USER INPUT] (never cached — §1.3). */
  userInput?: string;
}

export interface SystemPromptResult {
  stage: PipelineStage;
  /** §1.3 canonical section order: [SYSTEM] → [TOOL SCHEMAS] → [USER PREFERENCES] → [TASK] → [USER INPUT]. */
  sections: PromptSection[];
  /** Profile-version hash over the persona block — the [SYSTEM] cache key (Open Q5). */
  cacheKeyHash: string;
  /** True during the §19.13 60 s disable window — caller must skip applyCacheHints. */
  cacheDisabled: boolean;
}

/**
 * The D-59 single system-prompt assembly point. Persona-first, byte-stable
 * [SYSTEM] via PersonaInjector's inject function; sections tagged
 * stable/unstable per §1.3 (only [SYSTEM] + [TOOL SCHEMAS] are cache-eligible).
 */
export function buildSystemPrompt(
  stage: PipelineStage,
  opts?: BuildSystemPromptOptions,
): SystemPromptResult {
  const persona = resolvePersona(opts?.persona ?? DEFAULT_PERSONA, opts?.prefs);
  const personaBlock = buildPersonaBlock(persona);
  const cacheKeyHash = hashStableSections([{ text: personaBlock, stable: true }]);

  const systemText = PersonaInjector.inject(stage, canonicalStageString(stage), {
    persona,
    prefs: opts?.prefs,
  });

  const toolNames = opts?.toolNames ?? [];
  const toolSchemasText =
    toolNames.length === 0
      ? 'No tools are registered for this session.'
      : toolNames.map((name) => `- ${name}`).join('\n');

  const prefsText = prefsCompact(opts?.prefs);

  const sections: PromptSection[] = [
    { kind: 'SYSTEM', text: systemText, stable: true, tokens: estimateTokens(systemText) },
    {
      kind: 'TOOL SCHEMAS',
      text: toolSchemasText,
      stable: true,
      tokens: estimateTokens(toolSchemasText),
    },
    { kind: 'USER PREFERENCES', text: prefsText, stable: false, tokens: estimateTokens(prefsText) },
    { kind: 'TASK', text: opts?.task ?? '', stable: false, tokens: estimateTokens(opts?.task ?? '') },
    {
      kind: 'USER INPUT',
      text: opts?.userInput ?? '',
      stable: false,
      tokens: estimateTokens(opts?.userInput ?? ''),
    },
  ];

  return { stage, sections, cacheKeyHash, cacheDisabled: isCacheDisabled() };
}

/** §19.13 disable-window state. */
let consecutiveMisses = 0;
let disabledUntil = 0;

/**
 * Report one provider cache result. Five consecutive misses disable cache
 * hints for 60 s (spec 3060); a hit resets the streak.
 */
export function recordCacheResult(hit: boolean, now = Date.now()): void {
  if (hit) {
    consecutiveMisses = 0;
    return;
  }
  consecutiveMisses += 1;
  if (consecutiveMisses >= CACHE_DISABLE_MISS_THRESHOLD) {
    consecutiveMisses = 0;
    disabledUntil = now + CACHE_DISABLE_WINDOW_MS;
  }
}

export function isCacheDisabled(now = Date.now()): boolean {
  return now < disabledUntil;
}

/** Compact [USER PREFERENCES] rendering — includes persona overrides (§1.3). */
function prefsCompact(prefs?: UserPreferences): string {
  if (!prefs) return 'Default persona; no user preferences set.';
  const parts: string[] = [];
  if (prefs.fastModel) parts.push(`fastModel: ${prefs.fastModel}`);
  if (prefs.balancedModel) parts.push(`balancedModel: ${prefs.balancedModel}`);
  if (prefs.personaOverrides) {
    const o = prefs.personaOverrides;
    if (o.name) parts.push(`persona name: ${o.name}`);
    if (o.tone) parts.push(`tone: ${o.tone}`);
    if (o.brevity) parts.push(`brevity: ${o.brevity}`);
  }
  return parts.length === 0 ? 'Default persona; no user preferences set.' : parts.join('\n');
}