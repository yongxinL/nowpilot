import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PromptSection } from '../../../src/core/ai/types';
import { applyCacheHints, hashStableSections } from '../../../src/core/ai/PromptCacheAdapter';
import {
  PromptCacheManager,
  promptCacheManager,
} from '../../../src/core/context/PromptCacheManager';
import type { CacheAnnotatedSection } from '../../../src/core/ai/PromptCacheAdapter';
import type { CacheResponseMetadata, ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';

vi.mock('../../../src/core/ai/ProviderRouter', () => {
  return {
    providerRouter: {
      selectProvider: vi.fn().mockResolvedValue({
        adapter: {
          providerId: 'openai' as const,
          createLanguageModel: vi.fn(),
          validateConnection: vi.fn().mockResolvedValue({ ok: true, models: ['gpt-4o-mini'] }),
          supportsStructuredOutput: true,
          getDefaultModelForTier: vi.fn().mockReturnValue('gpt-4o-mini'),
          getCacheStrategy: vi.fn().mockReturnValue('prefix-only' as const),
          getTelemetryMetadata: vi.fn().mockReturnValue({ provider: 'openai' }),
        },
        providerId: 'openai',
      }),
      getCompressionModel: vi.fn().mockResolvedValue(null),
    },
  };
});

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

function asSections(adapted: unknown): CacheAnnotatedSection[] {
  return adapted as CacheAnnotatedSection[];
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

describe('PromptCacheManager recordResponse (D-15)', () => {
  const MISS: CacheResponseMetadata = { providerId: 'anthropic', cacheHit: false, cacheWrite: false };
  const HIT: CacheResponseMetadata = { providerId: 'anthropic', cacheHit: true, cacheWrite: false };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports a module-level singleton shared across surfaces (D-13)', () => {
    expect(promptCacheManager).toBeInstanceOf(PromptCacheManager);
  });

  it('resets missStreak and updates lastHit on a cache hit', () => {
    const manager = new PromptCacheManager();
    manager.recordResponse(HIT);
    const health = manager.getHealthState('anthropic');
    expect(health.missStreak).toBe(0);
    expect(health.lastHit).toBe(Date.now());
    expect(manager.isCacheDisabled('anthropic')).toBe(false);
  });

  it('increments missStreak on a miss', () => {
    const manager = new PromptCacheManager();
    manager.recordResponse(MISS);
    expect(manager.getHealthState('anthropic').missStreak).toBe(1);
    expect(manager.isCacheDisabled('anthropic')).toBe(false);
  });

  it('auto-disables cache after 5 consecutive misses per §19.13', () => {
    const manager = new PromptCacheManager();
    for (let i = 0; i < 5; i++) manager.recordResponse(MISS);
    expect(manager.getHealthState('anthropic').missStreak).toBe(5);
    expect(manager.isCacheDisabled('anthropic')).toBe(true);
  });

  it('re-enables cache after the 60,000ms cooldown (D-13)', () => {
    const manager = new PromptCacheManager();
    for (let i = 0; i < 5; i++) manager.recordResponse(MISS);
    expect(manager.isCacheDisabled('anthropic')).toBe(true);

    vi.advanceTimersByTime(60_001);
    expect(manager.isCacheDisabled('anthropic')).toBe(false);
    expect(manager.getHealthState('anthropic').missStreak).toBe(0);
  });

  it('a cache hit resets the miss streak before the cascade threshold', () => {
    const manager = new PromptCacheManager();
    for (let i = 0; i < 4; i++) manager.recordResponse(MISS);
    manager.recordResponse(HIT);
    expect(manager.getHealthState('anthropic').missStreak).toBe(0);
    expect(manager.isCacheDisabled('anthropic')).toBe(false);
  });

  it('a cache hit clears the disabled state immediately (re-enable on hit)', () => {
    const manager = new PromptCacheManager();
    for (let i = 0; i < 5; i++) manager.recordResponse(MISS);
    expect(manager.isCacheDisabled('anthropic')).toBe(true);
    manager.recordResponse(HIT);
    expect(manager.isCacheDisabled('anthropic')).toBe(false);
    expect(manager.getHealthState('anthropic').missStreak).toBe(0);
  });

  it('keeps per-provider health state independent', () => {
    const manager = new PromptCacheManager();
    for (let i = 0; i < 5; i++) manager.recordResponse(MISS);
    for (let i = 0; i < 2; i++) {
      manager.recordResponse({ providerId: 'gemini', cacheHit: false, cacheWrite: false });
    }
    expect(manager.isCacheDisabled('anthropic')).toBe(true);
    expect(manager.isCacheDisabled('gemini')).toBe(false);
    expect(manager.isCacheDisabled('openai')).toBe(false);
    expect(manager.isCacheDisabled('ollama')).toBe(false);
  });

  it('discards malformed metadata as a graceful no-op (T-04-15)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new PromptCacheManager();

    // Invalid providerId is logged and discarded
    manager.recordResponse({ providerId: 'not-a-provider', cacheHit: true, cacheWrite: false } as unknown as CacheResponseMetadata);
    // Non-boolean cacheHit is logged and discarded
    manager.recordResponse({ providerId: 'anthropic', cacheHit: 'yes' as unknown as boolean, cacheWrite: false });

    expect(manager.getHealthState('anthropic').missStreak).toBe(0);
    expect(manager.isCacheDisabled('anthropic')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('records cacheWrite without affecting health state (D-15)', () => {
    const manager = new PromptCacheManager();
    manager.recordResponse({ providerId: 'anthropic', cacheHit: false, cacheWrite: true });
    expect(manager.getHealthState('anthropic').missStreak).toBe(1);
  });
});

describe('PromptCacheManager prepareCacheHints (D-13)', () => {
  const sections: PromptSection[] = [
    {
      kind: 'system',
      text: 'You are a helpful assistant.',
      tokens: 7,
      stable: true,
      sourceId: 'core.instructions.system',
    },
    {
      kind: 'user_input',
      text: 'Hello',
      tokens: 2,
      stable: false,
      sourceId: 'interaction.user.current-turn',
    },
  ];

  it('delegates to applyCacheHints when cache is enabled', () => {
    const manager = new PromptCacheManager();
    const result = manager.prepareCacheHints('anthropic', sections);

    expect(result.strategy).toBe('anthropic-ephemeral');
    expect(result.cacheKeyHash).toMatch(/^[0-9a-f]{8}$/);
    expect(result.sections).toHaveLength(2);
    const annotated = result.sections[0] as CacheAnnotatedSection;
    expect(annotated.cache_control).toEqual({ type: 'ephemeral' });
    expect((result.sections[1] as CacheAnnotatedSection).cache_control).toBeUndefined();
    // Input sections are never mutated
    expect((sections[0] as CacheAnnotatedSection).cache_control).toBeUndefined();
  });

  it('returns sections unchanged with strategy disabled when cache is disabled (§19.13)', () => {
    const manager = new PromptCacheManager();
    for (let i = 0; i < 5; i++) {
      manager.recordResponse({ providerId: 'anthropic', cacheHit: false, cacheWrite: false });
    }
    expect(manager.isCacheDisabled('anthropic')).toBe(true);

    const result = manager.prepareCacheHints('anthropic', sections);
    expect(result.strategy).toBe('disabled');
    expect(result.sections).toEqual(sections);
    expect((result.sections[0] as CacheAnnotatedSection).cache_control).toBeUndefined();
    // Hash is still computed from stable sections (unused while disabled)
    expect(result.cacheKeyHash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('ContextOptimizer cache metadata (D-13 final stage)', () => {
  it('attaches cacheMetadata with cacheKeyHash and stableSectionCount to OptimizedContext', async () => {
    const { contextOptimizer } = await import('../../../src/core/context/ContextOptimizer');
    const result = await contextOptimizer.optimize({
      operationId: 'op-cache-1',
      model: 'gpt-4o-mini',
      modelContextWindow: 128000,
      userInput: 'Hello world',
      conversationId: 'conv-cache-1',
      workspaceId: 'ws-cache-1',
      activeSurface: 'sidepanel',
      selectedToolSchemas: [{ name: 'search', description: 'web search' }],
      memoryHints: [],
      preferences: {},
    });

    expect(result.cacheMetadata).toBeDefined();
    expect(result.cacheMetadata!.cacheKeyHash).toMatch(/^[0-9a-f]{8}$/);
    // system + tool_schemas + preferences are stable; memory/context/task/user_input are not (D-14)
    expect(result.cacheMetadata!.stableSectionCount).toBe(3);
  });
});

describe('ProviderAdapter countTokens (D-09)', () => {
  function baseAdapter(): ProviderAdapter {
    return {
      providerId: 'openai' as const,
      createLanguageModel: vi.fn(),
      validateConnection: vi.fn().mockResolvedValue({ ok: true, models: [] }),
      supportsStructuredOutput: true,
      getDefaultModelForTier: vi.fn().mockReturnValue('gpt-4o-mini'),
      getCacheStrategy: vi.fn().mockReturnValue('prefix-only' as const),
      getTelemetryMetadata: vi.fn().mockReturnValue({}),
    };
  }

  it('is optional — an adapter without countTokens falls back to character heuristics', async () => {
    const adapter = baseAdapter();
    expect(adapter.countTokens).toBeUndefined();
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    const count = adapter.countTokens
      ? await tokenBudget.estimateTokensFromNative('hello world', adapter.countTokens)
      : tokenBudget.estimateTokens('hello world');
    expect(count).toBe(3); // Math.ceil(11 / 4) per D-10
  });

  it('uses the native counter when the adapter provides countTokens', async () => {
    const adapter = { ...baseAdapter(), countTokens: async (text: string) => 42 };
    expect(typeof adapter.countTokens).toBe('function');
    const { tokenBudget } = await import('../../../src/core/context/TokenBudget');
    const count = await tokenBudget.estimateTokensFromNative('hello world', adapter.countTokens!);
    expect(count).toBe(42);
  });
});
