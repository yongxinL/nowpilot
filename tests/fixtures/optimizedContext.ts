// tests/fixtures/optimizedContext.ts — D-08 (03-03): deterministic, typed §2.3
// OptimizedContext builder. Fixed IDs, fixed persona/preferences, fixed section
// text — NEVER crypto.* or Date.now (determinism rule, fixtures/index.ts
// precedent). Edge-parameterized on tier/budget/privacyMode/persona so tests
// (Planner/Renderer/Orchestrator 03-04/03-06, PersonaInjector 03-07) can drive
// the same §2.3 shape from one builder. PromptSection[] is imported from
// '@/core/ai/types' (P-3 canonical home) — never re-declared (R-1). This is a
// TEST fixture, NOT a runtime module (D-08).
import type { ContextProvenanceManifest } from '@/core/context/ContextProvenanceManifest';
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import type { UserPreferences } from '@/core/memory/types';
import type { OptimizedContext, PromptSection } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Fixed constants (deterministic — no real randomness anywhere in this module)
// ---------------------------------------------------------------------------

export const FIXED_OPERATION_ID = 'op-fixture-0001';
export const FIXED_WORKSPACE_ID = 'ws-fixture-0001';
export const FIXED_CONVERSATION_ID = 'conv-fixture-0001';
// 04-03: MUST be a key of FIXED_MODEL_CONTEXT_WINDOWS (below) — the manifest's
// `window` field deep-links FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL], so the
// fixture's model is the canonical haiku key (claude-haiku-4-latest, 200K).
export const FIXED_MODEL = 'claude-haiku-4-latest';

/** Fixed persona block template (AI-05 byte-stability: ordered joins only). */
export const FIXED_PERSONA_BLOCK =
  'persona.name=Fixture Persona\npersona.tone=professional-warm\npersona.brevity=balanced';

export const FIXED_PREFERENCES: UserPreferences = {
  responseStyle: 'balanced',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false, // D-13: false → 'prefer-local'
  defaultProviderId: 'anthropic',
  toolAutonomy: 'allow_safe_tools',
  defaultSurface: 'sidepanel',
  personaId: 'fixture-persona',
  personaOverrides: {
    name: 'Fixture Persona',
    tone: 'professional-warm',
    brevity: 'balanced',
  },
};

// ---------------------------------------------------------------------------
// 04-01 additions (P4-15/WR-13): the canonical model-window set, over-budget
// section samples (the §2.4 ladder trigger material), and CJK/mixed-script
// text samples for the estimateTokens heuristic. All fixed — determinism rule.
// ---------------------------------------------------------------------------

/** Mirrors src/core/context/ModelContextTier.ts MODEL_CONTEXT_WINDOWS keys (D-04-04). */
export const FIXED_MODEL_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
  'claude-haiku-4-latest': 200_000,
  'deepseek-chat': 65_536,
  'gemini-2.5-flash': 1_048_576,
  'llama3.2:3b': 4_096,
  'qwen2.5:7b': 4_096,
} as const;

/** English-only sample — estimateTokens divisor 4 (D-04-10). */
export const ENGLISH_TEXT = 'The quick brown fox jumps over the lazy dog while packing.';

/** CJK-dominant sample (ratio >= 0.3) — estimateTokens divisor 3. */
export const CJK_TEXT = '你好世界，这是中文测试样本。';

/** Mixed-script sample (CJK ratio < 0.3) — the higher-cost divisor wins (P4-13). */
export const MIXED_TEXT = 'hello world this is mixed 文本 content';

/**
 * Over-budget PromptSection[] samples: per-kind token counts EXCEEDING the
 * medium-tier caps (inputBudget 16384 — §2.2 distribution: system 8% = 1311,
 * context 30% = 4916, user 15% = 2457). The §2.4 degradation ladder (04-02/
 * 04-04) consumes these as trigger material. Fixed token counts, no slicing.
 */
export const OVER_BUDGET_SECTIONS: PromptSection[] = [
  {
    kind: 'system',
    text: '[system: persona block over medium system cap]',
    tokens: 2000, // > 1311 medium system cap
    stable: true,
    sourceId: 'system',
  },
  {
    kind: 'context',
    text: '[context: extracted page content over medium context cap]',
    tokens: 6000, // > 4916 medium context cap
    stable: false,
    sourceId: 'context',
  },
  {
    kind: 'user_input',
    text: '[user input over medium user cap]',
    tokens: 3000, // > 2457 medium user cap
    stable: false,
    sourceId: 'user-input',
  },
  {
    kind: 'tool_result',
    text: '[tool result — uncapped but counted in totalTokens]',
    tokens: 999, // no cap applies; must still enter totalTokens (Pitfall 3)
    stable: false,
    sourceId: 'tool-result',
  },
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface OptimizedContextFixtureOverrides {
  tier?: ModelContextTier;
  inputBudget?: number;
  outputBudget?: number;
  minimalMode?: boolean;
  workspaceId?: string;
  activeSurface?: 'sidepanel' | 'standalone';
  /** persona block text — byte-stability edge (persona changes must change the cacheKeyHash). */
  personaBlock?: string;
  /** D-13 edge: false → 'prefer-local', true → 'cloud-ok'. */
  allowCloudFallbackFromLocal?: boolean;
  userInput?: string;
}

/** Default budgets per tier (edge-parameterized on tier). */
const TIER_BUDGETS: Record<ModelContextTier, { input: number; output: number }> = {
  tiny: { input: 1024, output: 256 },
  small: { input: 4096, output: 512 },
  medium: { input: 16384, output: 1024 },
  large: { input: 65536, output: 2048 },
};

/**
 * Build a deterministic §2.3 OptimizedContext. Fixed sourceIds and token counts;
 * every edge parameter (tier/budget/privacyMode/persona) is threaded through
 * overrides. Two calls with identical args deep-equal.
 */
export function buildOptimizedContextFixture(
  overrides: OptimizedContextFixtureOverrides = {},
): OptimizedContext {
  const tier: ModelContextTier = overrides.tier ?? 'tiny';
  const budgets = TIER_BUDGETS[tier];
  const inputBudget = overrides.inputBudget ?? budgets.input;
  const outputBudget = overrides.outputBudget ?? budgets.output;
  const workspaceId = overrides.workspaceId ?? FIXED_WORKSPACE_ID;
  const activeSurface = overrides.activeSurface ?? 'sidepanel';
  const minimalMode = overrides.minimalMode ?? false;
  const personaBlock = overrides.personaBlock ?? FIXED_PERSONA_BLOCK;
  const allowCloudFallbackFromLocal = overrides.allowCloudFallbackFromLocal ?? false;
  const userInput = overrides.userInput ?? 'Summarize the current page.';

  // §1.3 canonical order: [SYSTEM cached] [TOOL SCHEMAS cached] [USER PREFERENCES
  // compact] [MEMORY compact] [CONTEXT optimized] [TASK small] [USER INPUT current].
  const sections: PromptSection[] = [
    {
      kind: 'system',
      // The persona block is PREPENDED inside the cached [SYSTEM] section (AI-05);
      // byte-stability of this text is what keeps the provider prompt cache alive.
      text: `${personaBlock}\n\nYou are NowPilot, a privacy-first local assistant.`,
      tokens: 42,
      stable: true,
      sourceId: 'system',
    },
    {
      kind: 'tool_schemas',
      text: '[tool_schemas: get-provider-info]',
      tokens: 6,
      stable: true,
      sourceId: 'tool-schemas',
    },
    {
      kind: 'preferences',
      text: `[preferences] responseStyle=balanced preferredLanguage=en allowCloudFallbackFromLocal=${allowCloudFallbackFromLocal}`,
      tokens: 8,
      stable: true,
      sourceId: 'preferences',
    },
    {
      kind: 'memory',
      text: '[memory: user prefers concise summaries]',
      tokens: 5,
      stable: true,
      sourceId: 'memory',
    },
    {
      kind: 'context',
      text: '[context: extracted page content]',
      tokens: 10,
      stable: false,
      sourceId: 'context',
    },
    {
      kind: 'task',
      text: '[task: render a summary answer]',
      tokens: 4,
      stable: false,
      sourceId: 'task',
    },
    {
      kind: 'user_input',
      text: userInput,
      tokens: 6,
      stable: false,
      sourceId: 'user-input',
    },
  ];

  const provenance: ContextProvenanceManifest = {
    sections: sections.map((s) => ({
      kind: s.kind,
      sourceId: s.sourceId,
      tokens: s.tokens,
      truncated: false,
    })),
    totalTokens: sections.reduce((n, s) => n + s.tokens, 0),
    minimalMode,
    workspaceId,
    activeSurface,
    // 04-03 (D-04-17): deterministic provenance enumeration — the window
    // deep-links the fixture's own model-window map (never a second value).
    tier,
    model: FIXED_MODEL,
    window: FIXED_MODEL_CONTEXT_WINDOWS[FIXED_MODEL],
    counterMethod: 'heuristic', // D-04-10: provider-native counter absent in ai@4.3.19
    stepsFired: [], // no degradation in the default fixture
    // 04b-03 sync: receipt + CTX-06 counters are REQUIRED fields — deterministic
    // constants keep the fixture manifest schema-valid (ContextProvenanceManifest.test.ts
    // positive gate); 04b-04's trust stage wires the real values.
    receipt: [],
    counters: {
      screened: 0,
      quarantined: 0,
      byTrust: { system: 0, user: 0, tool: 0, retrieved: 0, untrusted: 0 },
      totalIncludedTokens: 0,
    },
  };

  return {
    tier,
    inputBudget,
    outputBudget,
    sections,
    provenance,
    minimalMode,
  };
}

/** Convenience: the full §2.3 shape including the fixed operation metadata. */
export interface OptimizedContextFixtureBundle {
  operationId: string;
  conversationId: string;
  model: string;
  preferences: UserPreferences;
  context: OptimizedContext;
}

export function buildOptimizedContextFixtureBundle(
  overrides: OptimizedContextFixtureOverrides = {},
): OptimizedContextFixtureBundle {
  return {
    operationId: FIXED_OPERATION_ID,
    conversationId: FIXED_CONVERSATION_ID,
    model: FIXED_MODEL,
    preferences: {
      ...FIXED_PREFERENCES,
      allowCloudFallbackFromLocal:
        overrides.allowCloudFallbackFromLocal ?? FIXED_PREFERENCES.allowCloudFallbackFromLocal,
    },
    context: buildOptimizedContextFixture(overrides),
  };
}
