import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../../../src/core/utils/RateLimiter';

describe('RateLimiter — token bucket (D-36, spec §13)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows capacity burst (capacity 3, refillPerSecond 1 — three immediate acquires succeed, fourth returns false)', () => {
    const limiter = new RateLimiter({ capacity: 3, refillPerSecond: 1 });
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);
  });

  it('refills tokens based on elapsed time (injectable clock) — false at 0 tokens, true again after refill interval', () => {
    let nowMs = 1_000_000;
    const now = (): number => nowMs;
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 2, now });

    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);

    // Advance virtual time by 500ms — at refillPerSecond 2, that's exactly 1 token
    nowMs += 500;
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);
  });

  it('caps the token count at capacity (no over-accumulation when no traffic for a long period)', () => {
    let nowMs = 1_000_000;
    const now = (): number => nowMs;
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 10, now });

    // Long idle — should accumulate up to capacity, never beyond.
    nowMs += 60_000;
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);
  });
});
