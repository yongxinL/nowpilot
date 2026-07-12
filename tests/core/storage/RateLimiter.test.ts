import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter } from '../../../src/core/utils/RateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows up to capacity tokens then denies', () => {
    const limiter = new RateLimiter({ capacity: 5, refillRate: 10 });

    // First 5 calls should be allowed
    for (let i = 0; i < 5; i++) {
      const result = limiter.tryAcquire();
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBe(0);
    }

    // 6th call should be denied
    const denied = limiter.tryAcquire();
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfter).toBeGreaterThan(0);
  });

  it('remaining count decrements correctly', () => {
    const limiter = new RateLimiter({ capacity: 3, refillRate: 100 });

    const r1 = limiter.tryAcquire();
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.tryAcquire();
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.tryAcquire();
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('retryAfter is positive when denied', () => {
    // capacity: 1, refillRate: 2 tokens/s => 500ms per token
    const limiter = new RateLimiter({ capacity: 1, refillRate: 2 });

    // Exhaust the single token
    const first = limiter.tryAcquire();
    expect(first.allowed).toBe(true);

    // Next call should be denied with retryAfter approximately 500ms
    const denied = limiter.tryAcquire();
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    // Should be around 500ms (give or take a few ms)
    expect(denied.retryAfter).toBeGreaterThan(400);
    expect(denied.retryAfter).toBeLessThan(600);
  });

  it('tokens refill over time', () => {
    vi.useFakeTimers();

    // capacity: 2, refillRate: 2 tokens/s => 500ms per token
    const limiter = new RateLimiter({ capacity: 2, refillRate: 2 });

    // Exhaust both tokens
    const r1 = limiter.tryAcquire();
    expect(r1.allowed).toBe(true);
    const r2 = limiter.tryAcquire();
    expect(r2.allowed).toBe(true);

    // Both tokens exhausted
    const r3 = limiter.tryAcquire();
    expect(r3.allowed).toBe(false);

    // Advance time by 500ms — one token should have refilled
    vi.advanceTimersByTime(500);
    const r4 = limiter.tryAcquire();
    expect(r4.allowed).toBe(true);
    expect(r4.remaining).toBe(0); // refilled one, immediately consumed

    // Advance another 500ms — another token refills
    vi.advanceTimersByTime(500);
    const r5 = limiter.tryAcquire();
    expect(r5.allowed).toBe(true);
  });

  it('tokens never exceed capacity even with long idle periods', () => {
    vi.useFakeTimers();

    const limiter = new RateLimiter({ capacity: 3, refillRate: 10 });

    // Exhaust all 3 tokens
    for (let i = 0; i < 3; i++) {
      const r = limiter.tryAcquire();
      expect(r.allowed).toBe(true);
    }

    // Verify exhausted
    const exhausted = limiter.tryAcquire();
    expect(exhausted.allowed).toBe(false);

    // Advance time by 10 seconds — would be 100 tokens worth of refill
    vi.advanceTimersByTime(10000);

    // But should be capped at capacity (3)
    const r1 = limiter.tryAcquire();
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2); // capped at 3, used 1

    const r2 = limiter.tryAcquire();
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.tryAcquire();
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th call should fail — only 3 tokens available
    const r4 = limiter.tryAcquire();
    expect(r4.allowed).toBe(false);
  });
});
