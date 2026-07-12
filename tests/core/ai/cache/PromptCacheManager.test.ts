import { describe, it, expect, beforeEach } from 'vitest';
import { PromptCacheManager } from '../../../../src/core/ai/cache/PromptCacheManager';
import type { CacheHint } from '../../../../src/core/ai/cache/cacheTypes';

describe('PromptCacheManager', () => {
  let manager: PromptCacheManager;

  beforeEach(() => {
    manager = new PromptCacheManager();
  });

  describe('identifyStableSections', () => {
    it('returns Map keyed by message index for system prompt and tool schema sections', () => {
      const promptParts = [
        { role: 'system', content: 'You are a helpful assistant.', section: 'system-prompt' as const },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const hints = manager.identifyStableSections(promptParts);
      expect(hints).toBeInstanceOf(Map);
      expect(hints.has(0)).toBe(true);
      const hint = hints.get(0) as CacheHint;
      expect(hint.section).toBe('system-prompt');
    });

    it('only marks CacheSection-tagged parts — not user messages or conversation history', () => {
      const promptParts = [
        { role: 'system', content: 'System prompt', section: 'system-prompt' as const },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'system', content: 'Tool definitions', section: 'tool-schemas' as const },
        { role: 'user', content: 'What time is it?' },
      ];
      const hints = manager.identifyStableSections(promptParts);
      // Tagged sections get hints
      expect(hints.has(0)).toBe(true);
      expect(hints.has(3)).toBe(true);
      // User/assistant messages do not
      expect(hints.has(1)).toBe(false);
      expect(hints.has(2)).toBe(false);
      expect(hints.has(4)).toBe(false);
      expect(hints.size).toBe(2);
    });

    it('returns CacheHint entries for preferences and memory sections as well', () => {
      const promptParts = [
        { role: 'system', content: 'Prefs', section: 'preferences' as const },
        { role: 'user', content: 'Hi' },
        { role: 'system', content: 'Memory', section: 'memory' as const },
      ];
      const hints = manager.identifyStableSections(promptParts);
      expect(hints.has(0)).toBe(true);
      expect(hints.get(0)?.section).toBe('preferences');
      expect(hints.has(2)).toBe(true);
      expect(hints.get(2)?.section).toBe('memory');
      expect(hints.size).toBe(2);
    });
  });

  describe('generateCacheKey', () => {
    it('returns a hash string for a providerId', () => {
      const key = manager.generateCacheKey('anthropic');
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('same providerId returns the same key until invalidated', () => {
      const key1 = manager.generateCacheKey('anthropic');
      const key2 = manager.generateCacheKey('anthropic');
      expect(key2).toBe(key1);
    });

    it('different providerIds return different keys', () => {
      const keyA = manager.generateCacheKey('anthropic');
      const keyO = manager.generateCacheKey('openai');
      expect(keyA).not.toBe(keyO);
    });
  });

  describe('invalidateCacheKey', () => {
    it('clears the cache key for that provider; next generateCacheKey returns a new key', () => {
      const key1 = manager.generateCacheKey('anthropic');
      manager.invalidateCacheKey('anthropic', 'provider config changed');
      const key2 = manager.generateCacheKey('anthropic');
      expect(key2).not.toBe(key1);
    });

    it('only invalidates the specified provider, not others', () => {
      const keyA1 = manager.generateCacheKey('anthropic');
      const keyO1 = manager.generateCacheKey('openai');
      manager.invalidateCacheKey('anthropic', 'test');
      const keyA2 = manager.generateCacheKey('anthropic');
      const keyO2 = manager.generateCacheKey('openai');
      expect(keyA2).not.toBe(keyA1);
      expect(keyO2).toBe(keyO1); // openai unaffected
    });
  });

  describe('invalidateAll', () => {
    it('clears all cache keys for all providers', () => {
      const keyA1 = manager.generateCacheKey('anthropic');
      const keyO1 = manager.generateCacheKey('openai');
      manager.invalidateAll();
      const keyA2 = manager.generateCacheKey('anthropic');
      const keyO2 = manager.generateCacheKey('openai');
      expect(keyA2).not.toBe(keyA1);
      expect(keyO2).not.toBe(keyO1);
    });
  });

  describe('singleton', () => {
    it('exports a singleton alongside the class', async () => {
      // Dynamic import to avoid ESM hoisting issues with circular patterns
      const mod = await import('../../../../src/core/ai/cache/PromptCacheManager');
      expect(mod.promptCacheManager).toBeDefined();
      expect(mod.promptCacheManager).toBeInstanceOf(PromptCacheManager);
    });
  });
});
