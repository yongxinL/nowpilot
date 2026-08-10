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
export const FIXED_MODEL = 'claude-3-5-haiku-latest';

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
