// tests/core/utils/RateLimiter.test.ts — §10.7/§13 per-instance token bucket
// contract (RESEARCH validation map: "RateLimiter per-instance token bucket").
// Cases: (1) capacity refills to full after the refill window (deterministic via
// vi.useFakeTimers — the class reads Date.now internally, so the fake clock
// drives the refill math); (2) getRateLimiter returns independent buckets per
// addonId — draining one never affects another (T-2-10-04); (3) tryAcquire
// exhausts the bucket and returns false without throwing; (4) waitForToken
// resolves false after the timeout on a depleted bucket (never hangs);
// (5) waitForToken resolves true when a token refills inside the timeout.
// Pure logic — node env avoids the jsdom 30 TextEncoder/esbuild invariant break
// (01-01 Rule 3 precedent, same as BroadcastBus.test.ts).
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter, getRateLimiter } from '@/core/utils/RateLimiter';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RateLimiter — per-instance token bucket', () => {
  it('refills to full capacity after the refill window', () => {
    vi.useFakeTimers();
    // capacity 3, refillPerSecond 0.05 → full refill needs 3 / 0.05 = 60s.
    const limiter = new RateLimiter('refill-a', { capacity: 3, refillPerSecond: 0.05 });

    expect(limiter.tryAcquire(3)).toBe(true); // burst drains the bucket
    expect(limiter.tryAcquire()).toBe(false); // empty immediately after

    vi.advanceTimersByTime(60_000); // full refill window elapses

    expect(limiter.tryAcquire(3)).toBe(true); // refilled to full
  });

  it('getRateLimiter returns independent buckets per addonId', () => {
    const a = getRateLimiter('iso-a');
    const b = getRateLimiter('iso-b');

    expect(a).not.toBe(b);
    expect(getRateLimiter('iso-a')).toBe(a); // same id → same instance (cached)

    expect(a.tryAcquire(10)).toBe(true); // drain a (default capacity 10)
    expect(b.tryAcquire(10)).toBe(true); // b unaffected — isolated bucket
    expect(a.tryAcquire()).toBe(false); // a stays depleted
    expect(b.tryAcquire()).toBe(false); // b only now empty too
  });

  it('tryAcquire exhausts the bucket and returns false without throwing', () => {
    const limiter = new RateLimiter('exhaust-a', { capacity: 2, refillPerSecond: 1 });

    expect(limiter.tryAcquire(2)).toBe(true);
    expect(limiter.tryAcquire()).toBe(false); // no throw — boolean contract
    expect(() => limiter.tryAcquire(5)).not.toThrow();
  });

  it('waitForToken resolves false after the timeout on a depleted bucket (never hangs)', async () => {
    vi.useFakeTimers();
    // refillPerSecond 0.0001 → effectively never refills inside the 100ms test.
    const limiter = new RateLimiter('wait-timeout-a', { capacity: 1, refillPerSecond: 0.0001 });
    limiter.tryAcquire(); // deplete

    const promise = limiter.waitForToken(1, 100);
    vi.advanceTimersByTime(150); // past the 100ms deadline

    await expect(promise).resolves.toBe(false);
  });

  it('waitForToken resolves true once a token refills inside the timeout', async () => {
    vi.useFakeTimers();
    // refillPerSecond 2 → 1 token every 500ms; timeout 5000ms is plenty.
    const limiter = new RateLimiter('wait-ok-a', { capacity: 1, refillPerSecond: 2 });
    limiter.tryAcquire(); // deplete

    const promise = limiter.waitForToken(1, 5000);
    vi.advanceTimersByTime(600); // 1.2 tokens accrued → available

    await expect(promise).resolves.toBe(true);
  });
});
