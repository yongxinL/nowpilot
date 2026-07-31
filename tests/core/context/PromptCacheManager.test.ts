import { describe, it, expect } from 'vitest';
import type { PromptSection } from '../../../src/core/ai/types';
import { applyCacheHints, hashStableSections } from '../../../src/core/ai/PromptCacheAdapter';

function section(overrides: Partial<PromptSection>): PromptSection {
  return {
    kind: 'system',
    text: '',
    tokens: 100,
    stable: true,
    sourceId: 'core.instructions.system',
    ...overrides,
  };
}

function asSections(adapted: unknown): PromptSection[] {
  return adapted as PromptSection[];
}

function asGeminiShape(adapted: unknown): { cachedContent?: PromptSection[]; inline: PromptSection[] } {
  return adapted as { cachedContent?: PromptSection[]; inline: PromptSection[] };
}

describe('PromptCacheAdapter cache hints — anthropic', () => {
  it('marks at most 4 stable sections with ephemeral cache_control (Appendix K)', () => {
    const sections: PromptSection[] = [
      section({ text: 's1' }),
      section({ text: 's2' }),
      section({ text: 's3' }),
      section({ text: 's4' }),
      section({ text: 's5' }),
      section({ text: 'u1', stable: false, sourceId: 'interaction.user.current-turn' }),
    ];

    const result = applyCacheHints('anthropic', sections);
    const out = asSections(result.providerRequestSections);

    expect(out).toHaveLength(6);
    // First 4 stable sections get the ephemeral cache breakpoint
    expect(out[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(out[1].cache_control).toEqual({ type: 'ephemeral' });
    expect(out[2].cache_control).toEqual({ type: 'ephemeral' });
    expect(out[3].cache_control).toEqual({ type: 'ephemeral' });
    // 5th stable section exceeds ANTHROPIC_MAX_BREAKPOINTS — no cache_control
    expect(out[4].cache_control).toBeUndefined();
    // Unstable sections are never cache candidates (D-14)
    expect(out[5].cache_control).toBeUndefined();
    expect(result.strategy).toBe('anthropic-ephemeral');
    expect(result.cacheKeyHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('leaves all sections untouched and hashes empty string when no stable sections exist', () => {
    const sections: PromptSection[] = [
      section({ text: 'u1', stable: false, sourceId: 'interaction.user.current-turn' }),
      section({ text: 'u2', stable: false, sourceId: 'context.page.current' }),
    ];

    const result = applyCacheHints('anthropic', sections);
    const out = asSections(result.providerRequestSections);

    expect(out).toHaveLength(2);
    expect(out[0].cache_control).toBeUndefined();
    expect(out[1].cache_control).toBeUndefined();
    expect(result.strategy).toBe('anthropic-ephemeral');
    // FNV-1a of "" is the offset basis 2166136261 = 0x811c9dc5
    expect(result.cacheKeyHash).toBe('811c9dc5');
  });
});

describe('PromptCacheAdapter cache hints — gemini', () => {
  it('uses cachedContent when stable tokens reach the 32,768 minimum', () => {
    const sections: PromptSection[] = [
      section({ kind: 'system', text: 'sys', tokens: 20_000 }),
      section({ kind: 'tool_schemas', text: 'tools', tokens: 20_000 }),
      section({ text: 'u1', stable: false, sourceId: 'interaction.user.current-turn' }),
    ];

    const result = applyCacheHints('gemini', sections);
    const shape = asGeminiShape(result.providerRequestSections);

    expect(shape.cachedContent).toHaveLength(2);
    expect(shape.cachedContent?.map((s) => s.text)).toEqual(['sys', 'tools']);
    expect(shape.inline).toHaveLength(1);
    expect(shape.inline[0].sourceId).toBe('interaction.user.current-turn');
    expect(result.strategy).toBe('gemini-cachedContent');
    expect(result.cacheKeyHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('falls back to prefix-only when stable tokens are below 32,768', () => {
    const sections: PromptSection[] = [
      section({ kind: 'system', text: 'sys', tokens: 200 }),
      section({ kind: 'tool_schemas', text: 'tools', tokens: 200 }),
      section({ text: 'u1', stable: false, sourceId: 'interaction.user.current-turn' }),
    ];

    const result = applyCacheHints('gemini', sections);
    const shape = asGeminiShape(result.providerRequestSections);

    expect(shape.cachedContent).toBeUndefined();
    expect(shape.inline).toHaveLength(3);
    expect(result.strategy).toBe('prefix-only');
  });
});

describe('PromptCacheAdapter cache hints — openai/ollama', () => {
  const unordered: PromptSection[] = [
    section({ kind: 'user_input', text: 'u', stable: false, sourceId: 'interaction.user.current-turn' }),
    section({ kind: 'system', text: 's' }),
    section({ kind: 'context', text: 'c', stable: false, sourceId: 'context.page.current' }),
    section({ kind: 'preferences', text: 'p' }),
    section({ kind: 'task', text: 't', stable: false, sourceId: 'core.task.placeholder' }),
    section({ kind: 'tool_schemas', text: 'ts' }),
  ];

  it('orders stable sections first (sorted by kind), then unstable, for openai', () => {
    const result = applyCacheHints('openai', unordered);
    const out = asSections(result.providerRequestSections);

    // Stable group sorted by kind: preferences, system, tool_schemas
    expect(out.map((s) => s.kind)).toEqual([
      'preferences',
      'system',
      'tool_schemas',
      'context',
      'task',
      'user_input',
    ]);
    expect(result.strategy).toBe('prefix-only');
  });

  it('orders stable sections first (sorted by kind), then unstable, for ollama', () => {
    const result = applyCacheHints('ollama', unordered);
    const out = asSections(result.providerRequestSections);

    expect(out.map((s) => s.kind)).toEqual([
      'preferences',
      'system',
      'tool_schemas',
      'context',
      'task',
      'user_input',
    ]);
    expect(result.strategy).toBe('prefix-only');
  });

  it('does not mutate the input sections array', () => {
    const input = [...unordered];
    applyCacheHints('openai', unordered);
    expect(unordered.map((s) => s.kind)).toEqual(input.map((s) => s.kind));
  });
});

describe('PromptCacheAdapter cache hints — FNV-1a hash', () => {
  it('produces a consistent 8-char hex hash for identical stable section text (D-16)', () => {
    const a = [section({ text: 'system' }), section({ text: 'tools' })];
    const b = [section({ text: 'system' }), section({ text: 'tools' })];

    const h1 = hashStableSections(a);
    const h2 = hashStableSections(b);

    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
    expect(h2).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces different hashes for different stable section text', () => {
    const a = [section({ text: 'system' })];
    const b = [section({ text: 'persona' })];

    expect(hashStableSections(a)).not.toBe(hashStableSections(b));
  });

  it('produces different hashes for different stable section sets (collision avoidance)', () => {
    const setA = [section({ text: 'a' }), section({ text: 'b' })];
    const setB = [section({ text: 'x' }), section({ text: 'y' })];

    expect(hashStableSections(setA)).not.toBe(hashStableSections(setB));
    // The \0 delimiter keeps concatenation sets distinct from joined-single sets
    const joined = [section({ text: 'ab' })];
    expect(hashStableSections(setA)).not.toBe(hashStableSections(joined));
  });

  it('only hashes stable sections — unstable sections do not affect the hash (D-14)', () => {
    const stableOnly = [section({ text: 'sys' }), section({ text: 'tools' })];
    const withUnstable = [
      section({ text: 'sys' }),
      section({ text: 'tools' }),
      section({ text: 'user input', stable: false, sourceId: 'interaction.user.current-turn' }),
    ];

    expect(hashStableSections(withUnstable)).toBe(hashStableSections(stableOnly));
  });

  it('hashes the empty string (FNV-1a offset basis) when there are no stable sections', () => {
    const unstable = [section({ text: 'u', stable: false, sourceId: 'interaction.user.current-turn' })];
    expect(hashStableSections(unstable)).toBe('811c9dc5');
  });
});
