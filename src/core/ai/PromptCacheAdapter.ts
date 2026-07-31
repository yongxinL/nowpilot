// src/core/ai/PromptCacheAdapter.ts
import type { PipelineProviderId, PromptSection } from './types';
export interface CacheAdaptedPrompt {
  providerRequestSections: unknown;
  cacheKeyHash: string;
  strategy: 'anthropic-ephemeral' | 'gemini-cachedContent' | 'prefix-only';
}
const ANTHROPIC_MAX_BREAKPOINTS = 4;
const GEMINI_MIN_CACHED_TOKENS = 32_768;
export function applyCacheHints(
  providerId: PipelineProviderId,
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
export function hashStableSections(sections: Array<Pick<PromptSection, 'text' | 'stable'>>): string {
  const stable = sections.filter((s) => s.stable).map((s) => s.text).join('\u0000');
  let h = 2166136261;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
