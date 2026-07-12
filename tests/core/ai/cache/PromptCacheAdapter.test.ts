import { describe, it, expect } from 'vitest';
import {
  applyAnthropicCache,
  applyOpenAICache,
  applyGoogleCache,
  applyCacheHints,
} from '../../../../src/core/ai/cache/PromptCacheAdapter';
import type { CacheHint } from '../../../../src/core/ai/cache/cacheTypes';

function createHintMap(entries: Array<[number, Partial<CacheHint>]>): Map<number, CacheHint> {
  const map = new Map<number, CacheHint>();
  for (const [idx, partial] of entries) {
    map.set(idx, {
      section: partial.section ?? ('system-prompt' as const),
      messageIndices: partial.messageIndices ?? [idx],
      ttl: partial.ttl ?? 3600,
    });
  }
  return map;
}

const simpleMessages = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'user' as const, content: 'Hello!' },
  { role: 'assistant' as const, content: 'Hi there!' },
];

describe('applyAnthropicCache', () => {
  it('adds cacheControl ephemeral to marked messages', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyAnthropicCache(simpleMessages, hintMap);

    // Marked message at index 0 gets providerOptions
    expect(result[0]).toHaveProperty('providerOptions');
    expect((result[0] as any).providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });

    // Unmarked messages keep original shape
    expect(result[1]).not.toHaveProperty('providerOptions');
    expect(result[2]).not.toHaveProperty('providerOptions');
    expect((result[1] as any).content).toBe('Hello!');
    expect((result[2] as any).content).toBe('Hi there!');
  });

  it('unmarked messages are returned without cache options', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyAnthropicCache(simpleMessages, hintMap);

    expect(result[1]).not.toHaveProperty('providerOptions');
    expect(result[2]).not.toHaveProperty('providerOptions');
  });

  it('empty hintMap returns all messages unchanged', () => {
    const hintMap = new Map<number, CacheHint>();
    const result = applyAnthropicCache(simpleMessages, hintMap);

    expect(result).toHaveLength(3);
    for (const msg of result) {
      expect(msg).not.toHaveProperty('providerOptions');
    }
  });

  it('handles multiple marked messages', () => {
    const messages = [
      { role: 'system' as const, content: 'System prompt' },
      { role: 'system' as const, content: 'Tool schemas' },
      { role: 'user' as const, content: 'Hello' },
    ];
    const hintMap = createHintMap([
      [0, { section: 'system-prompt' }],
      [1, { section: 'tool-schemas' }],
    ]);
    const result = applyAnthropicCache(messages, hintMap);

    expect((result[0] as any).providerOptions).toBeDefined();
    expect((result[1] as any).providerOptions).toBeDefined();
    expect(result[2]).not.toHaveProperty('providerOptions');
  });
});

describe('applyOpenAICache', () => {
  it('returns request-level providerOptions with promptCacheKey, mode and ttl', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyOpenAICache(simpleMessages, hintMap, 'cache-key-abc');

    expect(result.providerOptions).toBeDefined();
    expect(result.providerOptions.openai).toEqual({
      promptCacheKey: 'cache-key-abc',
      promptCacheOptions: { mode: 'auto', ttl: 3600 },
    });
  });

  it('marks last cached message with promptCacheBreakpoint', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyOpenAICache(simpleMessages, hintMap, 'key-1');

    const msg0 = result.messages[0] as any;
    expect(msg0.providerOptions).toBeDefined();
    expect(msg0.providerOptions.openai.promptCacheBreakpoint).toBe(true);

    // Unmarked messages don't get breakpoint
    expect((result.messages[1] as any).providerOptions).toBeUndefined();
    expect((result.messages[2] as any).providerOptions).toBeUndefined();
  });

  it('empty hintMap returns no providerOptions and no breakpoints', () => {
    const hintMap = new Map<number, CacheHint>();
    const result = applyOpenAICache(simpleMessages, hintMap, 'key-1');

    // When hintMap is empty, providerOptions.openai should not be set
    // (or at least promptCacheKey should not be present)
    expect(result.providerOptions.openai).toBeUndefined();
    for (const msg of result.messages) {
      expect((msg as any).providerOptions).toBeUndefined();
    }
  });
});

describe('applyGoogleCache', () => {
  it('wraps cached content in providerOptions.google.cachedContent', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyGoogleCache(simpleMessages, hintMap);

    expect((result[0] as any).providerOptions).toEqual({
      google: { cachedContent: 'You are a helpful assistant.' },
    });
    expect(result[1]).not.toHaveProperty('providerOptions');
    expect(result[2]).not.toHaveProperty('providerOptions');
  });

  it('empty hintMap returns all messages unchanged', () => {
    const hintMap = new Map<number, CacheHint>();
    const result = applyGoogleCache(simpleMessages, hintMap);

    expect(result).toHaveLength(3);
    for (const msg of result) {
      expect(msg).not.toHaveProperty('providerOptions');
    }
  });
});

describe('applyCacheHints (dispatcher)', () => {
  it('routes to Anthropic adapter', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyCacheHints('anthropic', simpleMessages, hintMap, 'key');

    expect(result.messages).toHaveLength(3);
    // Anthropic: first message should have providerOptions with cacheControl
    const msg0 = result.messages[0] as any;
    expect(msg0.providerOptions).toBeDefined();
    expect(msg0.providerOptions.anthropic?.cacheControl?.type).toBe('ephemeral');
  });

  it('routes to OpenAI adapter', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyCacheHints('openai', simpleMessages, hintMap, 'key-xyz');

    expect(result.providerOptions).toBeDefined();
    expect((result.providerOptions as any)?.openai?.promptCacheKey).toBe('key-xyz');
  });

  it('routes to Google adapter', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyCacheHints('google', simpleMessages, hintMap, 'key');

    const msg0 = result.messages[0] as any;
    expect(msg0.providerOptions).toBeDefined();
    expect(msg0.providerOptions.google?.cachedContent).toBe('You are a helpful assistant.');
  });

  it('Ollama returns messages unchanged (no-op)', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyCacheHints('ollama', simpleMessages, hintMap, 'key');

    // Ollama has no cache support — messages returned as-is, no providerOptions
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].content).toBe('You are a helpful assistant.');
    expect(result.messages[1].content).toBe('Hello!');
    expect(result.messages[2].content).toBe('Hi there!');
    expect((result as any).providerOptions).toBeUndefined();
  });

  it('unknown provider returns messages unchanged', () => {
    const hintMap = createHintMap([[0, { section: 'system-prompt' }]]);
    const result = applyCacheHints('unknown-provider', simpleMessages, hintMap, 'key');

    expect(result.messages).toHaveLength(3);
    for (const msg of result.messages) {
      expect((msg as any).providerOptions).toBeUndefined();
    }
    expect((result as any).providerOptions).toBeUndefined();
  });

  it('empty hintMap with dispatcher returns messages unchanged', () => {
    const hintMap = new Map<number, CacheHint>();
    const result = applyCacheHints('anthropic', simpleMessages, hintMap, 'key');

    expect(result.messages).toHaveLength(3);
    for (const msg of result.messages) {
      expect((msg as any).providerOptions).toBeUndefined();
    }
  });
});
