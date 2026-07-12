import { debugLog } from '../../utils/debugLog';
import type { CacheHint, CacheKey } from './cacheTypes';

const VALID_SECTIONS = new Set(['system-prompt', 'tool-schemas', 'preferences', 'memory']);

export class PromptCacheManager {
  #cacheKeys = new Map<string, CacheKey>();
  #sectionHints = new Map<string, CacheHint[]>();
  #keyCounter = 0;

  /**
   * Identifies stable prompt sections and returns a Map of message index → CacheHint.
   * Only sections tagged with a valid CacheSection type (system-prompt, tool-schemas,
   * preferences, memory) receive cache hints — user messages and conversation history are excluded.
   */
  identifyStableSections(
    promptParts: Array<{ role: string; content: string; section?: string }>,
  ): Map<number, CacheHint> {
    const hints = new Map<number, CacheHint>();

    for (let i = 0; i < promptParts.length; i++) {
      const part = promptParts[i];
      if (!part.section || !VALID_SECTIONS.has(part.section)) continue;

      const hint: CacheHint = {
        section: part.section as 'system-prompt' | 'tool-schemas' | 'preferences' | 'memory',
        messageIndices: [i],
        ttl: 3600,
      };
      hints.set(i, hint);
    }

    return hints;
  }

  /**
   * Generates a deterministic cache key for the given provider.
   * Returns the existing key if one exists and hasn't been invalidated.
   * Returns a new DJB2-hashed key otherwise.
   */
  generateCacheKey(providerId: string): string {
    const existing = this.#cacheKeys.get(providerId);
    if (existing) return existing.hash;

    this.#keyCounter++;
    const hash = this.#simpleHash(providerId + Date.now().toString() + this.#keyCounter);
    const cacheKey: CacheKey = {
      providerId,
      hash,
      createdAt: Date.now(),
    };
    this.#cacheKeys.set(providerId, cacheKey);
    return hash;
  }

  /**
   * Invalidates the cache key for a specific provider.
   * Logs the invalidation event with providerId and reason.
   */
  invalidateCacheKey(providerId: string, reason: string): void {
    this.#cacheKeys.delete(providerId);
    debugLog('info', '[PromptCacheManager] Cache key invalidated', { providerId, reason });
  }

  /**
   * Invalidates all cache keys across all providers.
   * Logs the global invalidation event.
   */
  invalidateAll(): void {
    this.#cacheKeys.clear();
    debugLog('info', '[PromptCacheManager] All cache keys invalidated');
  }

  /**
   * Simple DJB2 hash function for cache key generation.
   * Not suitable for security — used only for cache segmentation.
   */
  #simpleHash(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash) + input.charCodeAt(i);
    }
    // Convert to unsigned 32-bit then to base-36 string
    return (hash >>> 0).toString(36);
  }
}

export const promptCacheManager = new PromptCacheManager();
