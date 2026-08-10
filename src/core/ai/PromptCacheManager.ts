// src/core/ai/PromptCacheManager.ts — Source: PRODUCT_SPEC §19.13 "Prompt Cache
// Miss Cascade" (line 3126-3128): "If provider reports zero cache hit for 5
// consecutive requests, PromptCacheManager disables cache hints for 60 s to
// avoid overhead." The manager tracks consecutive misses and exposes
// hintsEnabled() so the Router (03-05) can skip emitting providerOptions
// cache hints during the cooldown. Hits reset the counter. The cascade is a
// COST guardrail (R-2): when the provider's cache is not engaging (Phase-3
// prompts are far below Anthropic's 4,096-token minimum), hint emission is
// pure overhead — pausing it bounds the waste. Pure in-memory module; no
// storage, no zustand/react (Pitfall 4). Determinism note: hit/miss bookkeeping
// uses an injectable clock so tests are stable without fake timers.

export interface PromptCacheManager {
  /** Report a provider cache hit — resets the consecutive-miss counter. */
  recordHit(): void;
  /** Report a provider cache miss — may trigger the §19.13 cooldown. */
  recordMiss(): void;
  /** True while cache hints are allowed (not in the 60 s post-cascade cooldown). */
  hintsEnabled(): boolean;
  /** Number of consecutive misses since the last hit (observable for tests/traces). */
  consecutiveMissCount(): number;
  /** Test/UAT isolation — resets the counter and any active cooldown. */
  reset(): void;
}

/** §19.13: zero hits for this many consecutive requests disables hints. */
export const CONSECUTIVE_MISS_THRESHOLD = 5;
/** §19.13: the cooldown window while hints are disabled. */
export const HINTS_DISABLED_MS = 60_000;

export function createPromptCacheManager(now: () => number = Date.now): PromptCacheManager {
  let consecutiveMisses = 0;
  let disabledUntil = 0;
  return {
    recordHit() {
      consecutiveMisses = 0;
    },
    recordMiss() {
      consecutiveMisses += 1;
      if (consecutiveMisses >= CONSECUTIVE_MISS_THRESHOLD) {
        // §19.13 cascade: disable hints for 60 s; the counter re-arms so a
        // second cascade can trigger after the cooldown if misses persist.
        disabledUntil = now() + HINTS_DISABLED_MS;
        consecutiveMisses = 0;
      }
    },
    hintsEnabled() {
      return now() >= disabledUntil;
    },
    consecutiveMissCount() {
      return consecutiveMisses;
    },
    reset() {
      consecutiveMisses = 0;
      disabledUntil = 0;
    },
  };
}

let singleton: PromptCacheManager | null = null;

/**
 * Lazy singleton (ProviderRegistry precedent). The Router (03-05) reads
 * hintsEnabled() before emitting cache hints; phase-3 consumers never
 * construct their own manager.
 */
export function getPromptCacheManager(): PromptCacheManager {
  if (singleton === null) singleton = createPromptCacheManager();
  return singleton;
}

/** Named singleton export (03-03 artifact list: getPromptCacheManager()/promptCacheManager). */
export const promptCacheManager: PromptCacheManager = getPromptCacheManager();
