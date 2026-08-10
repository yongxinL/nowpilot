// src/core/ai/TierResolver.ts — Source: PRODUCT_SPEC Appendix D "Tier → Model
// Resolver Table" (lines 5134-5188) verbatim + D-13 (privacyModeFromPrefs).
// Maps the 'haiku' | 'flash' tier → concrete (providerId, model) candidates;
// resolveTier picks the CHEAPEST capable candidate and NEVER invents a model
// name (Appendix D rule; §0.2). The 'local-only' filter branch is present
// verbatim but RESERVED — nothing calls resolveTier with it this phase (D-13:
// the §1.5 boolean governs fallback direction, enforced in ProviderRouter, not
// a resolveTier filter).
import type { ProviderId } from './types';
import type { UserPreferences } from '../memory/types';

export type ModelTier = 'haiku' | 'flash';

export interface TierCandidate {
  providerId: ProviderId;
  model: string;
}

export const TIER_TO_MODEL_CANDIDATES: Record<ModelTier, TierCandidate[]> = {
  haiku: [
    { providerId: 'anthropic', model: 'claude-haiku-4-latest' },
    { providerId: 'openai', model: 'deepseek-chat' },
    { providerId: 'ollama', model: 'llama3.2:3b' },
  ],
  flash: [
    { providerId: 'gemini', model: 'gemini-2.5-flash' },
    { providerId: 'anthropic', model: 'claude-haiku-4-latest' },
    { providerId: 'openai', model: 'deepseek-chat' },
    { providerId: 'ollama', model: 'qwen2.5:7b' },
  ],
} as const;

/** D-13: 'local-only' is RESERVED for a future explicit privacy toggle. */
export type PrivacyMode = 'local-only' | 'prefer-local' | 'cloud-ok';

export interface TierResolveInput {
  tier: ModelTier;
  configuredProviders: Array<{
    id: ProviderId;
    models: string[];
    enabled: boolean;
    priority: number;
  }>;
  privacyMode: PrivacyMode;
}

export interface TierResolveResult {
  providerId: ProviderId;
  model: string;
  fallbackChain: TierCandidate[];
}

export function resolveTier(input: TierResolveInput): TierResolveResult | null {
  const candidates = TIER_TO_MODEL_CANDIDATES[input.tier].filter((c) => {
    if (input.privacyMode === 'local-only') return c.providerId === 'ollama';
    return true;
  });
  const enabled = input.configuredProviders
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);
  const chosen: TierCandidate[] = [];
  for (const c of candidates) {
    const cfg = enabled.find((p) => p.id === c.providerId);
    if (cfg && cfg.models.includes(c.model)) chosen.push(c);
  }
  if (chosen.length === 0) return null;
  return {
    providerId: chosen[0].providerId,
    model: chosen[0].model,
    fallbackChain: chosen.slice(1),
  };
}

/**
 * D-13 privacy-mode mapping (Q5). Pure helper — no new preferences field, no
 * second source of truth. `allowCloudFallbackFromLocal: false → 'prefer-local'`
 * (default when prefs are absent or the field is malformed); `true → 'cloud-ok'`.
 * `'local-only'` is reserved and never produced here.
 */
export function privacyModeFromPrefs(
  prefs?: Pick<UserPreferences, 'allowCloudFallbackFromLocal'>,
): PrivacyMode {
  if (!prefs || typeof prefs.allowCloudFallbackFromLocal !== 'boolean') return 'prefer-local';
  return prefs.allowCloudFallbackFromLocal ? 'cloud-ok' : 'prefer-local';
}
