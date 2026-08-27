import type { ModelTier, ProviderId } from './types';
import { useUserPreferencesStore } from './UserPreferences';
import { ProviderRegistry } from './ProviderRegistry';
import { debugLog } from '../log/debugLog';

/**
 * TierResolver — Appendix D mechanism verbatim (privacyMode filtering +
 * priority order) with the D-53/D-54/D-54a overrides (plan 03-05, Task 2).
 *
 * D-53: `TIER_TO_MODEL_CANDIDATES` ships capability tiers ONLY — keys
 * 'fast' | 'balanced', values are capability descriptors (operator-selected
 * low-cost vs higher-capability per provider), NEVER vendor model slugs.
 * No stale model names, no vendor churn. OpenAICompat has NO default entry
 * (D-56) — it is tier-mapped only when the operator assigns a model.
 *
 * D-54/D-54a: `resolveTier` returns the concrete (providerId, model) pair
 * ONLY from persisted `UserPreferences.fastModel`/`balancedModel`
 * (np_preferences, plan 03-02) validated against the live-discovered model
 * cache (D-52). Until both preferences are explicitly persisted, the
 * unresolved tier resolves to null — no inference, no auto-assignment, no
 * substitution, no guessing (Appendix D rule: "never invents a model name").
 * The caller (AgentOrchestrator, 03-06) surfaces a configuration-required
 * state and starts NO provider request. Options pre-fill suggestions are
 * UI-only and MUST NOT affect runtime routing until confirmed and persisted.
 */

/** D-53: capability descriptor — a tier slot, never a concrete model slug. */
export interface TierCapabilityDescriptor {
  providerId: ProviderId;
  /**
   * Capability descriptor only ('low-cost' fast-tier vs 'higher-capability'
   * balanced-tier per provider). NOT a vendor model slug — D-53.
   */
  capability: 'low-cost' | 'higher-capability';
}

/**
 * D-53 capability-tier table. Provider list mirrors Appendix D's candidate
 * sets (fast: anthropic/openai/ollama; balanced: gemini/anthropic/openai/
 * ollama) with the D-56 exclusion of OpenAICompat. Concrete slugs are never
 * shipped here — they come from live discovery (D-52) + operator assignment
 * (D-54).
 */
export const TIER_TO_MODEL_CANDIDATES: Record<ModelTier, readonly TierCapabilityDescriptor[]> = {
  fast: [
    { providerId: 'anthropic', capability: 'low-cost' },
    { providerId: 'openai', capability: 'low-cost' },
    { providerId: 'ollama', capability: 'low-cost' },
  ],
  balanced: [
    { providerId: 'gemini', capability: 'higher-capability' },
    { providerId: 'anthropic', capability: 'higher-capability' },
    { providerId: 'openai', capability: 'higher-capability' },
    { providerId: 'ollama', capability: 'higher-capability' },
  ],
};

/** Appendix D privacyMode values — all three honored. */
export type PrivacyMode = 'local-only' | 'prefer-local' | 'cloud-ok';

export interface TierResolveOptions {
  /** Appendix D privacyMode (default 'cloud-ok'). */
  privacyMode?: PrivacyMode;
}

/** Concrete tier resolution — the (providerId, model) pair for one tier. */
export interface TierResolution {
  providerId: ProviderId;
  model: string;
}

/**
 * Resolve one tier to a concrete (providerId, model) — Appendix D mechanism
 * (privacyMode filtering + prefer-local ollama-first reorder) applied to the
 * D-53 capability table, with the model taken from persisted prefs (D-54)
 * validated against the D-52 live-discovery cache.
 *
 * NULL CONTRACT (D-54a): returns null when the tier's preference is not
 * persisted, or when the persisted model is not in any eligible provider's
 * discovered model set. Never invents a model name.
 */
export function resolveTier(tier: ModelTier, opts: TierResolveOptions = {}): TierResolution | null {
  const prefs = useUserPreferencesStore.getState();
  const model = tier === 'fast' ? prefs.fastModel : prefs.balancedModel;

  // D-54a: an unpersisted preference resolves to null — no inference, no
  // substitution. The caller surfaces configuration-required.
  if (model === undefined || model === '') {
    debugLog('TIER_UNRESOLVED', `${tier} tier has no persisted model`, { tier });
    return null;
  }

  // Appendix D mechanism verbatim: privacyMode filtering + prefer-local
  // reorders ollama to the front. 'local-only' → ollama candidates only.
  let candidates = TIER_TO_MODEL_CANDIDATES[tier].filter((c) =>
    (opts.privacyMode ?? 'cloud-ok') === 'local-only' ? c.providerId === 'ollama' : true,
  );
  if (opts.privacyMode === 'prefer-local') {
    candidates = [
      ...candidates.filter((c) => c.providerId === 'ollama'),
      ...candidates.filter((c) => c.providerId !== 'ollama'),
    ];
  }

  // D-52/D-51: the persisted model must appear in an eligible (enabled +
  // discovered) candidate provider's session cache. Cache empty (discovery
  // never ran) or model absent → null (stale assignment is never trusted).
  for (const candidate of candidates) {
    const normalized = ProviderRegistry.getById(candidate.providerId);
    const cached = ProviderRegistry.getCachedModels(candidate.providerId);
    if (normalized !== undefined && normalized.enabled && cached !== undefined && cached.includes(model)) {
      return { providerId: candidate.providerId, model };
    }
  }

  debugLog('TIER_UNRESOLVED', `${tier} persisted model not in any candidate's discovered set`, {
    tier,
  });
  return null;
}