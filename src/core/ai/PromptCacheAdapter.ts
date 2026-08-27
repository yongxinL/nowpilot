// Appendix K (PRODUCT_SPEC_v0_1.md:5747-5821) — verbatim semantics.
//
// Per-provider prompt-cache hints. Only stable sections are cache-eligible
// (§1.3); cacheKeyHash feeds PromptTrace.promptCache.cacheKey (§4.3 — Phase 11).
//
// Import-target change: the spec imports PromptSection from
// `../context/ContextOptimizer` (Phase 5); Phase 3 supplies the A8 shape from
// `./types` (plan 03-01). The persona block sits in the stable [SYSTEM]
// section and is therefore cache-eligible — it must stay byte-stable per
// persona (Pitfall 3; 03-02's buildPersonaBlock guarantees this).
import type { ProviderId, PromptSection } from './types';

export interface CacheAdaptedPrompt {
  providerRequestSections: unknown;
  cacheKeyHash: string;
  strategy: 'anthropic-ephemeral' | 'gemini-cachedContent' | 'prefix-only';
}

/** Anthropic: at most 4 explicit cache breakpoints — a 5th returns HTTP 400 (Pitfall 5). */
export const ANTHROPIC_MAX_BREAKPOINTS = 4;

/** Gemini: cachedContent only at/above the 32,768-token minimum (Pitfall 4). */
export const GEMINI_MIN_CACHED_TOKENS = 32_768;

export function applyCacheHints(
  providerId: ProviderId,
  sections: PromptSection[],
): CacheAdaptedPrompt {
  switch (providerId) {
    case 'anthropic': {
      let marked = 0;
      const out = sections.map((s) => {
        if (s.stable && marked < ANTHROPIC_MAX_BREAKPOINTS) {
          marked++;
          return { ...s, cache_control: { type: 'ephemeral' as const } };
        }
        return s;
      });
      return {
        providerRequestSections: out,
        cacheKeyHash: hashStableSections(sections),
        strategy: 'anthropic-ephemeral',
      };
    }
    case 'gemini': {
      const stable = sections.filter((s) => s.stable);
      const stableTokens = stable.reduce((n, s) => n + s.tokens, 0);
      if (stableTokens >= GEMINI_MIN_CACHED_TOKENS) {
        return {
          providerRequestSections: {
            cachedContent: stable,
            inline: sections.filter((s) => !s.stable),
          },
          cacheKeyHash: hashStableSections(stable),
          strategy: 'gemini-cachedContent',
        };
      }
      return {
        providerRequestSections: { inline: sections },
        cacheKeyHash: hashStableSections(stable),
        strategy: 'prefix-only',
      };
    }
    case 'openai':
    case 'ollama':
    default: {
      const ordered = [...sections].sort(stableFirst);
      return {
        providerRequestSections: ordered,
        cacheKeyHash: hashStableSections(ordered.filter((s) => s.stable)),
        strategy: 'prefix-only',
      };
    }
  }
}

function stableFirst(a: PromptSection, b: PromptSection) {
  if (a.stable !== b.stable) return a.stable ? -1 : 1;
  return a.kind.localeCompare(b.kind);
}

/** FNV-1a 32-bit over the joined stable section texts (Appendix K verbatim). */
export function hashStableSections(
  sections: Array<Pick<PromptSection, 'text' | 'stable'>>,
): string {
  const stable = sections
    .filter((s) => s.stable)
    .map((s) => s.text)
    .join('\u0000');
  let h = 2166136261;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}