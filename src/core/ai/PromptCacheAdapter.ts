// src/core/ai/PromptCacheAdapter.ts — Source: PRODUCT_SPEC Appendix K (lines
// 5745-5818, VERBATIM) + the F-5 extension (03-03): applyCacheHints additionally
// returns the providerOptions.anthropic.cacheControl payload the Router applies
// (03-05, F-5 application owner) — this module emits the STRATEGY, it never
// constructs a provider call itself.
//
// Per-provider cache-hint strategies: 'anthropic-ephemeral' (≤4 breakpoints,
// cache_control on stable sections — the persona block inside [SYSTEM] is
// stable and therefore cache-eligible), 'gemini-cachedContent' (only ≥32,768
// stable tokens — dormant at Phase-3 prompt sizes; NO CachedContent API client
// is built this phase, hash/strategy only), 'prefix-only' (openai/ollama —
// stable sections sorted first so the byte-stable prefix is contiguous).
// hashStableSections is FNV-1a (32-bit) byte-stable over UTF-16 code units
// (AI-05 [encoding]): the cacheKeyHash must be identical across turns for the
// same persona so the provider prompt cache can hit (Pitfall 5).
import type { ProviderId } from '@/core/ai/types';
// P-3: PromptSection's canonical home is @/core/ai/types (Appendix C) — imported, never re-declared (R-1).
import type { PromptSection } from '@/core/ai/types';

export interface CacheAdaptedPrompt {
  providerRequestSections: unknown;
  cacheKeyHash: string;
  strategy: 'anthropic-ephemeral' | 'gemini-cachedContent' | 'prefix-only';
  /**
   * F-5 extension: the providerOptions.anthropic.cacheControl payload the Router
   * applies to the constructed messages[] call (03-05) — { anthropic: { cacheControl:
   * { type: 'ephemeral' } } } when a hint is emitted, undefined otherwise. The Router
   * threads this through StreamAdapter into the CoreSystemMessage (F-5, 03-03).
   */
  providerOptions?: { anthropic: { cacheControl: { type: 'ephemeral' } } };
}

export const ANTHROPIC_MAX_BREAKPOINTS = 4;
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
        // F-5: only when at least one stable breakpoint was marked.
        ...(marked > 0 ? { providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' as const } } } } : {}),
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

/**
 * FNV-1a 32-bit hash of the stable sections' text (byte-stable, AI-05). Only
 * stable sections are eligible for cache hints — non-stable text never affects
 * the hash. Join separator is \u0000 so section boundaries cannot collide.
 */
export function hashStableSections(
  sections: Array<Pick<PromptSection, 'text' | 'stable'>>,
): string {
  const stable = sections.filter((s) => s.stable).map((s) => s.text).join('\u0000');
  let h = 2166136261;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
