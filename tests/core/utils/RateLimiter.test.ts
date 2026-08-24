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

  it('accumulates fractional tokens precisely — refillPerSecond 0.5 over 2000ms yields exactly one token (no rounding drift)', () => {
    let nowMs = 1_000_000;
    const now = (): number => nowMs;
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 0.5, now });

    // Drain the bucket.
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);

    // 1999ms — not yet one full token; must remain false.
    nowMs += 1999;
    expect(limiter.acquire()).toBe(false);

    // 2ms more (2001ms total elapsed) — strictly past the boundary; exactly one token available.
    nowMs += 2;
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);
  });

  it('handles zero refill cleanly — bucket stays empty once drained and time passes', () => {
    let nowMs = 1_000_000;
    const now = (): number => nowMs;
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 0, now });

    expect(limiter.acquire()).toBe(true);
    nowMs += 60_000;
    expect(limiter.acquire()).toBe(false);
  });

  it('refills to capacity in chunks across multiple acquire calls (smooth refill, not one-shot)', () => {
    let nowMs = 1_000_000;
    const now = (): number => nowMs;
    const limiter = new RateLimiter({ capacity: 4, refillPerSecond: 1, now });

    // Drain the bucket.
    for (let i = 0; i < 4; i++) expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);

    // One second elapsed — exactly one token available; consume it.
    nowMs += 1_000;
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);

    // Three more seconds — three more tokens, never exceeding capacity.
    nowMs += 3_000;
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);
  });
});
