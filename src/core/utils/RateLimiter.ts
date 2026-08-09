// src/core/utils/RateLimiter.ts — §10.7/§13 per-instance token bucket keyed by
// addonId. Each add-on owns its own limiter — never shared across addonIds
// (§13: "RateLimiter is per-instance. Each add-on owns its limiter; never
// shared"). Phase 8 add-ons (ServiceNow, Write, TeamGQM) call tryAcquire /
// waitForToken ahead of their Requester PROXY_FETCH traffic. The token-bucket
// parameters are pinned named constants, not magic numbers — Phase 8 consumers
// can pass their own RateLimiterConfig without any signature change (CONTEXT
// 'the agent's Discretion', A-21). Dependency-free primitive (R-3/R-4-safe for
// later panel usage): imports nothing from zustand/storage — there is no error
// path here (tryAcquire returns false, waitForToken resolves false; nothing
// throws), so no @/core/error import is needed either.
export interface RateLimiterConfig {
  /** Maximum tokens the bucket can hold (burst ceiling). */
  capacity: number;
  /** Continuous refill rate in tokens per second. */
  refillPerSecond: number;
}

export const DEFAULT_CAPACITY = 10;
export const DEFAULT_REFILL_PER_SECOND = 2;
const DEFAULT_WAIT_TIMEOUT_MS = 5000;
/** Polling granularity for waitForToken — small enough to be responsive. */
const POLL_INTERVAL_MS = 25;

export class RateLimiter {
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private tokens: number;
  private lastRefillAt: number;

  /**
   * Per-addon instance — the constructor is keyed by addonId (per-instance
   * semantics §10.7). Config is optional; defaults are pinned constants.
   */
  constructor(
    private readonly addonId: string,
    config: RateLimiterConfig = { capacity: DEFAULT_CAPACITY, refillPerSecond: DEFAULT_REFILL_PER_SECOND },
  ) {
    this.capacity = config.capacity;
    this.refillPerSecond = config.refillPerSecond;
    this.tokens = config.capacity; // start full
    this.lastRefillAt = Date.now();
  }

  /** Lazy refill: accrue tokens by elapsed time at refillPerSecond, capped. */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillAt;
    if (elapsedMs <= 0) return;
    const accrued = (elapsedMs / 1000) * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + accrued);
    this.lastRefillAt = now;
  }

  /**
   * Synchronous acquire. On success deducts tokens and returns true; on
   * failure returns false WITHOUT throwing (callers check the boolean).
   */
  tryAcquire(tokens = 1): boolean {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  /**
   * Async acquire — polls until a token is available or the timeout expires
   * (default 5000ms). Resolves true on acquire, false on timeout; never hangs
   * and never throws.
   */
  async waitForToken(tokens = 1, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS): Promise<boolean> {
    if (this.tryAcquire(tokens)) return true;
    const deadline = Date.now() + timeoutMs;
    return new Promise<boolean>((resolve) => {
      const poll = setInterval(() => {
        if (this.tryAcquire(tokens)) {
          clearInterval(poll);
          resolve(true);
        } else if (Date.now() >= deadline) {
          clearInterval(poll);
          resolve(false);
        }
      }, POLL_INTERVAL_MS);
    });
  }
}

const limiters = new Map<string, RateLimiter>();

/**
 * Module-level factory keeping a Map<addonId, RateLimiter> (ProviderRegistry
 * lazy-instance pattern). Instances are NEVER shared across addonIds — each
 * add-on gets its own bucket so one add-on cannot exhaust another's capacity
 * (T-2-10-04).
 */
export function getRateLimiter(addonId: string): RateLimiter {
  let limiter = limiters.get(addonId);
  if (!limiter) {
    limiter = new RateLimiter(addonId);
    limiters.set(addonId, limiter);
  }
  return limiter;
}
