// tests/core/ai/PromptCacheAdapter.test.ts — Appendix K contract (03-03): the
// anthropic branch marks ≤4 stable sections with cache_control and emits the
// F-5 providerOptions.anthropic.cacheControl payload the Router applies; the
// gemini branch only engages ≥32_768 stable tokens (dormant at Phase-3 sizes —
// hash/strategy only, NO CachedContent client); openai/ollama get prefix-only
// with stable-first ordering. hashStableSections is FNV-1a byte-stable over
// UTF-16 code units (AI-05): the persona block inside [SYSTEM] must hash
// identically across turns so the provider cache can hit.
import { describe, expect, it } from 'vitest';

import {
  ANTHROPIC_MAX_BREAKPOINTS,
  GEMINI_MIN_CACHED_TOKENS,
  applyCacheHints,
  hashStableSections,
} from '@/core/ai/PromptCacheAdapter';
import type { ProviderId, PromptSection } from '@/core/ai/types';

function section(
  partial: Partial<PromptSection> & Pick<PromptSection, 'kind' | 'text'>,
): PromptSection {
  return {
    tokens: 10,
    stable: true,
    sourceId: 'system',
    ...partial,
  };
}

/** FNV-1a known answers (computed independently — empty = offset basis). */
describe('hashStableSections — FNV-1a byte-stability (AI-05)', () => {
  it('returns the FNV-1a offset-basis hash for no stable sections (empty join)', () => {
    expect(hashStableSections([])).toBe('811c9dc5'); // FNV-1a 32-bit of ''
  });

  it('is deterministic — identical stable text hashes identically', () => {
    const sections = [
      section({ kind: 'system', text: 'persona.name=Fixture\npersona.tone=warm', tokens: 20 }),
      section({ kind: 'tool_schemas', text: '[tools]', sourceId: 'tool-schemas' }),
    ];
    expect(hashStableSections(sections)).toBe(hashStableSections(sections));
  });

  it('a single-byte change in a stable section changes the hash (byte-stability)', () => {
    const a = hashStableSections([section({ kind: 'system', text: 'tone=warm' })]);
    const b = hashStableSections([section({ kind: 'system', text: 'tone=Warm' })]);
    expect(a).not.toBe(b);
  });

  it('non-stable sections never affect the hash (only stable text is joined)', () => {
    const stable = [section({ kind: 'system', text: 'stable-block' })];
    const unstableA = section({ kind: 'user_input', text: 'ask one', stable: false });
    const unstableB = section({ kind: 'user_input', text: 'ask two', stable: false });
    expect(hashStableSections([...stable, unstableA])).toBe(
      hashStableSections([...stable, unstableB]),
    );
  });

  it('matches a known FNV-1a value for a fixed block', () => {
    // 'abc' → FNV-1a 32-bit 0x1a47e90c (verified independently)
    expect(hashStableSections([section({ kind: 'system', text: 'abc' })])).toBe('1a47e90c');
  });
});

describe('applyCacheHints — anthropic branch (Appendix K + F-5)', () => {
  it("returns strategy 'anthropic-ephemeral' and marks ≤4 stable sections", () => {
    const sections = Array.from({ length: 6 }, (_, i) =>
      section({ kind: 'system', text: `stable-${i}` }),
    );
    const result = applyCacheHints('anthropic', sections);

    expect(result.strategy).toBe('anthropic-ephemeral');
    const marked = (
      result.providerRequestSections as Array<PromptSection & { cache_control?: unknown }>
    ).filter((s) => s.cache_control !== undefined);
    expect(marked).toHaveLength(ANTHROPIC_MAX_BREAKPOINTS); // 4 of the 6
    for (const m of marked) {
      expect(m.cache_control).toEqual({ type: 'ephemeral' });
    }
  });

  it('F-5: emits a valid providerOptions.anthropic.cacheControl payload when a breakpoint is marked', () => {
    const result = applyCacheHints('anthropic', [
      section({ kind: 'system', text: 'persona-block' }),
      section({ kind: 'tool_schemas', text: '[tools]', sourceId: 'tool-schemas' }),
    ]);

    // The Router (03-05) applies this exact shape to the CoreSystemMessage via
    // StreamAdapter (F-5): providerOptions.anthropic.cacheControl, type 'ephemeral'.
    expect(result.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });
  });

  it('emits NO providerOptions payload when no stable section exists (nothing to cache)', () => {
    const result = applyCacheHints('anthropic', [
      section({ kind: 'user_input', text: 'ask', stable: false }),
    ]);
    expect(result.providerOptions).toBeUndefined();
    expect(result.strategy).toBe('anthropic-ephemeral');
  });

  it('cacheKeyHash covers the persona block inside the stable [SYSTEM] section', () => {
    const withPersona = applyCacheHints('anthropic', [
      section({ kind: 'system', text: 'persona.name=Alice\npersona.tone=warm' }),
    ]);
    const otherPersona = applyCacheHints('anthropic', [
      section({ kind: 'system', text: 'persona.name=Bob\npersona.tone=warm' }),
    ]);
    expect(withPersona.cacheKeyHash).not.toBe(otherPersona.cacheKeyHash);
  });
});

describe('applyCacheHints — gemini branch (Appendix K)', () => {
  it('returns prefix-only below the 32_768-token minimum (dormant at Phase-3 sizes)', () => {
    const sections = [section({ kind: 'system', text: 'small-block', tokens: 500 })];
    const result = applyCacheHints('gemini', sections);

    expect(result.strategy).toBe('prefix-only');
    expect(result.providerOptions).toBeUndefined();
    expect(result.providerRequestSections).toEqual({ inline: sections });
  });

  it('returns gemini-cachedContent when stable tokens reach the minimum', () => {
    const bigStable = section({
      kind: 'system',
      text: 'cached-content-block',
      tokens: GEMINI_MIN_CACHED_TOKENS,
    });
    const unstable = section({ kind: 'user_input', text: 'ask', stable: false });
    const result = applyCacheHints('gemini', [bigStable, unstable]);

    expect(result.strategy).toBe('gemini-cachedContent');
    // Dormant branch: NO CachedContent API client built this phase — the shape
    // is hash/strategy only; providerRequestSections split cached vs inline.
    expect(result.providerRequestSections).toEqual({
      cachedContent: [bigStable],
      inline: [unstable],
    });
    expect(result.providerOptions).toBeUndefined();
  });
});

describe('applyCacheHints — openai/ollama prefix-only branch (Appendix K)', () => {
  it.each(['openai', 'ollama'] as ProviderId[])(
    "returns 'prefix-only' with stable sections sorted first for %s",
    (providerId) => {
      const unstable = section({ kind: 'user_input', text: 'ask', stable: false });
      const stableSys = section({ kind: 'system', text: 'sys' });
      const result = applyCacheHints(providerId, [unstable, stableSys]);

      expect(result.strategy).toBe('prefix-only');
      // stableFirst: stable sections precede non-stable so the byte-stable
      // prefix is contiguous for the provider cache.
      expect(result.providerRequestSections).toEqual([stableSys, unstable]);
      expect(result.providerOptions).toBeUndefined();
    },
  );
});

describe('applyCacheHints — cacheKeyHash consistency across strategies', () => {
  it('the anthropic cacheKeyHash equals hashStableSections over the same sections', () => {
    const sections = [section({ kind: 'system', text: 'stable' })];
    expect(applyCacheHints('anthropic', sections).cacheKeyHash).toBe(hashStableSections(sections));
  });
});
