/**
 * Token bucket rate limiter — per D-20 through D-23.
 *
 * Configurable capacity (burst) and refill rate (tokens/second).
 * In-memory only (D-23). Returns structured results, never throws (D-21).
 */

export interface RateLimiterConfig {
  /** Max tokens (burst capacity) */
  capacity: number;
  /** Tokens per second */
  refillRate: number;
}

export interface RateLimitResult {
  /** true if a token was acquired */
  allowed: boolean;
  /** Tokens remaining after this call (0 if not allowed) */
  remaining: number;
  /** Milliseconds until next token available (0 if allowed) */
  retryAfter: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillIntervalMs: number;

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
    this.refillIntervalMs = 1000 / config.refillRate;
  }

  /**
   * Try to acquire a token from the bucket.
   *
   * Returns a structured result object — never throws (D-21).
   * Callers decide whether to queue, retry, or notify.
   */
  tryAcquire(): RateLimitResult {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, remaining: Math.floor(this.tokens), retryAfter: 0 };
    }
    const deficit = 1 - this.tokens;
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(deficit * this.refillIntervalMs),
    };
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   * Tokens are capped at capacity — burst capacity never exceeded (D-20).
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed / this.refillIntervalMs;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }
}
