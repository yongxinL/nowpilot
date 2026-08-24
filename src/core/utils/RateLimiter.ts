/**
 * Per-instance token-bucket RateLimiter (spec §13, D-36).
 *
 * Per-instance by design — each add-on / fetch boundary owns its limiter;
 * never shared. The bucket is initialized at full capacity and refills
 * smoothly via elapsed-time math (no timers — this keeps the module
 * trivially testable with an injected `now()` clock and avoids the
 * ambient timer cost).
 *
 * `acquire()` is non-throwing by contract (D-36, PLAN-LOCAL choice): it
 * returns `true` and consumes one token when at least one is available,
 * `false` when the bucket is empty. The caller (Requester) maps `false`
 * to the canonical `RATE_LIMITED` error code (REQ-R07 closed set).
 */
export interface RateLimiterOptions {
  /** Maximum number of tokens the bucket can hold (initial + ceiling). */
  capacity: number;
  /** Tokens added per second; can be fractional (e.g. 0.5 = one token per 2 s). */
  refillPerSecond: number;
  /** Optional clock injection seam; defaults to `Date.now`. Test-only. */
  now?: () => number;
}

export class RateLimiter {
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: () => number;
  private tokens: number;
  private lastRefillMs: number;

  constructor(options: RateLimiterOptions) {
    if (!Number.isFinite(options.capacity) || options.capacity < 0) {
      throw new Error(`RateLimiter: capacity must be a non-negative finite number (got ${options.capacity})`);
    }
    if (!Number.isFinite(options.refillPerSecond) || options.refillPerSecond < 0) {
      throw new Error(`RateLimiter: refillPerSecond must be a non-negative finite number (got ${options.refillPerSecond})`);
    }
    this.capacity = options.capacity;
    this.refillPerSecond = options.refillPerSecond;
    this.now = options.now ?? Date.now;
    this.tokens = options.capacity;
    this.lastRefillMs = this.now();
  }

  /**
   * Consume one token if available. Returns `true` on success, `false`
   * when the bucket is empty (caller maps to `RATE_LIMITED`).
   *
   * Refill is computed lazily on every call: `deltaSeconds * refillPerSecond`
   * tokens are added, capped at `capacity`. Fractional tokens accumulate
   * without rounding drift so the boundary case
   * `refillPerSecond=0.5` over `2000 ms` yields exactly one token.
   */
  acquire(): boolean {
    const currentMs = this.now();
    const deltaSeconds = Math.max(0, (currentMs - this.lastRefillMs) / 1000);
    if (deltaSeconds > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + deltaSeconds * this.refillPerSecond);
      this.lastRefillMs = currentMs;
    }
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}
