import type { PipelineProviderId, PromptSection } from '../ai/types';
import type { CacheResponseMetadata } from '../ai/providers/ProviderAdapter';
import { applyCacheHints, hashStableSections } from '../ai/PromptCacheAdapter';

/**
 * Per-provider runtime cache health (D-13). This state is IN-MEMORY ONLY —
 * it is never persisted to chrome.storage, localStorage, or IndexedDB
 * (D-13 prohibition). After a service worker/page reload the singleton is
 * recreated with fresh health, which is correct behavior per RESEARCH.md
 * Pitfall 3: cache should be retried after a fresh start.
 */
export interface ProviderCacheHealth {
  /** Consecutive cache misses per §19.13. */
  missStreak: number;
  /** Timestamp of the last cache hit (ms). */
  lastHit: number;
  /** Timestamp until which the cache is disabled (ms); null = enabled. */
  disabledUntil: number | null;
}

const VALID_PROVIDERS: readonly PipelineProviderId[] = ['openai', 'anthropic', 'gemini', 'ollama'];

/** Miss cascade threshold per §19.13: 5 consecutive misses disable the cache. */
const MISS_CASCADE_THRESHOLD = 5;

/** Cooldown per D-13: 60,000ms (60s) after the cascade threshold is hit. */
const CACHE_COOLDOWN_MS = 60_000;

/**
 * Cache policy + health layer of the three-layer cache architecture
 * (D-12). Tracks per-provider hit/miss health, enforces the §19.13 miss
 * cascade (auto-disable after 5 consecutive misses, re-enable after the
 * 60s cooldown), and delegates per-provider hint transformation to
 * PromptCacheAdapter (Appendix K).
 */
export class PromptCacheManager {
  private health: Map<PipelineProviderId, ProviderCacheHealth> = new Map();

  constructor() {
    // Initialize health for all 4 providers
    for (const pid of VALID_PROVIDERS) {
      this.health.set(pid, { missStreak: 0, lastHit: 0, disabledUntil: null });
    }
  }

  /**
   * Record a cache response — call after a provider request completes
   * (D-15). A hit resets the miss streak and clears any disabled state; a
   * miss increments the streak and disables the cache when the §19.13
   * threshold is reached. Malformed metadata is logged and discarded as a
   * graceful no-op (T-04-15).
   */
  recordResponse(metadata: CacheResponseMetadata): void {
    if (!this.isValidMetadata(metadata)) {
      console.warn('[PromptCacheManager] discarding malformed cache response metadata', metadata);
      return;
    }

    const health = this.getOrCreateHealth(metadata.providerId);

    if (metadata.cacheHit) {
      health.missStreak = 0;
      health.lastHit = Date.now();
      health.disabledUntil = null;
      return;
    }

    health.missStreak += 1;
    if (health.missStreak >= MISS_CASCADE_THRESHOLD) {
      health.disabledUntil = Date.now() + CACHE_COOLDOWN_MS;
      console.warn(
        `[PromptCacheManager] cache disabled for ${metadata.providerId} after ` +
          `${health.missStreak} consecutive misses (${CACHE_COOLDOWN_MS}ms cooldown, §19.13)`,
      );
    }
    // The cacheWrite flag is logged context; it does not affect health state (D-15).
  }

  /**
   * Whether the cache is currently disabled for a provider (cooldown
   * window active per §19.13). Once the disabledUntil timestamp passes,
   * the health is reset and the cache re-enables automatically.
   */
  isCacheDisabled(providerId: PipelineProviderId): boolean {
    const health = this.health.get(providerId);
    if (!health || health.disabledUntil === null) return false;

    if (Date.now() >= health.disabledUntil) {
      health.missStreak = 0;
      health.disabledUntil = null;
      return false;
    }
    return true;
  }

  /**
   * Read-only view of a provider's health state — consumed by tests and
   * by the Phase 6 diagnostics surface (RESEARCH.md Pitfall 3: missStreak
   * is diagnosable). Never used to mutate health externally.
   */
  getHealthState(providerId: PipelineProviderId): Readonly<ProviderCacheHealth> {
    return this.getOrCreateHealth(providerId);
  }

  /**
   * Prepare provider-specific cache hints for sections (D-13). Delegates
   * to PromptCacheAdapter.applyCacheHints() (Appendix K) when the cache is
   * enabled; when disabled, returns the sections unchanged with strategy
   * 'disabled' so the provider request path is identical either way.
   */
  prepareCacheHints(
    providerId: PipelineProviderId,
    sections: PromptSection[],
  ): { sections: PromptSection[]; cacheKeyHash: string; strategy: string } {
    if (this.isCacheDisabled(providerId)) {
      return {
        sections,
        cacheKeyHash: hashStableSections(sections),
        strategy: 'disabled',
      };
    }

    const adapted = applyCacheHints(providerId, sections);

    // The flat sections contract always holds: anthropic/openai/ollama
    // produce an annotated array; gemini produces the {cachedContent,
    // inline} split, which flattens back to the section order (stable
    // first, then unstable) for the consumer pipeline.
    let sectionsOut: PromptSection[];
    if (Array.isArray(adapted.providerRequestSections)) {
      sectionsOut = adapted.providerRequestSections as PromptSection[];
    } else {
      const split = adapted.providerRequestSections as {
        cachedContent: PromptSection[];
        inline: PromptSection[];
      };
      sectionsOut = [...split.cachedContent, ...split.inline];
    }

    return {
      sections: sectionsOut,
      cacheKeyHash: adapted.cacheKeyHash,
      strategy: adapted.strategy,
    };
  }

  private getOrCreateHealth(providerId: PipelineProviderId): ProviderCacheHealth {
    let state = this.health.get(providerId);
    if (!state) {
      state = { missStreak: 0, lastHit: 0, disabledUntil: null };
      this.health.set(providerId, state);
    }
    return state;
  }

  /** Metadata validation per T-04-15: providerId + boolean flags. */
  private isValidMetadata(metadata: CacheResponseMetadata): boolean {
    return (
      (VALID_PROVIDERS as readonly string[]).includes(metadata.providerId) &&
      typeof metadata.cacheHit === 'boolean' &&
      typeof metadata.cacheWrite === 'boolean'
    );
  }
}

/** Module-level singleton shared across all surfaces (D-13). */
export const promptCacheManager = new PromptCacheManager();
