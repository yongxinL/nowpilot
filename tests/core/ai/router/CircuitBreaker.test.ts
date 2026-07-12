import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker } from '../../../../src/core/ai/router/CircuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CLOSED state', () => {
    it('starts CLOSED for any provider', () => {
      expect(breaker.isOpen('provider-a')).toBe(false);
      expect(breaker.getState('provider-a')).toBe('CLOSED');
    });

    it('after 3 recordFailure calls within 60s window, isOpen returns true (circuit opens)', () => {
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(false); // not yet 3

      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(true); // opens
    });

    it('recordSuccess on CLOSED circuit resets failure count to 0', () => {
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      breaker.recordSuccess('provider-a');

      // After reset, 2 more failures should NOT open (we're at 0 again)
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(false);
    });

    it('failures outside the 60s window are pruned and do not count toward threshold', () => {
      breaker.recordFailure('provider-a'); // t=0
      breaker.recordFailure('provider-a'); // t=0

      // Advance 61s — both failures should be pruned
      vi.advanceTimersByTime(61_000);

      // 2 more failures should be in a fresh window
      breaker.recordFailure('provider-a'); // t=61s
      breaker.recordFailure('provider-a'); // t=61s
      expect(breaker.isOpen('provider-a')).toBe(false); // not yet 3 in this window

      breaker.recordFailure('provider-a'); // t=61s
      expect(breaker.isOpen('provider-a')).toBe(true); // 3 in current window
    });
  });

  describe('OPEN state', () => {
    it('after 5 minutes cooldown, isOpen returns false and transitions to HALF_OPEN (probe allowed)', () => {
      // Open the circuit
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(true);
      expect(breaker.getState('provider-a')).toBe('OPEN');

      // Advance 5 minutes — cooldown should expire
      vi.advanceTimersByTime(5 * 60_000);

      expect(breaker.isOpen('provider-a')).toBe(false); // probe allowed
      expect(breaker.getState('provider-a')).toBe('HALF_OPEN');
    });

    it('isOpen still returns true before cooldown expires', () => {
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(true);

      // Advance only 4 minutes — cooldown NOT expired
      vi.advanceTimersByTime(4 * 60_000);

      expect(breaker.isOpen('provider-a')).toBe(true); // still open
      expect(breaker.getState('provider-a')).toBe('OPEN');
    });
  });

  describe('HALF_OPEN state', () => {
    it('recordSuccess transitions back to CLOSED (probe succeeded)', () => {
      // Open the circuit
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(true);

      // Wait for cooldown
      vi.advanceTimersByTime(5 * 60_000);

      // Probe: isOpen returns false (HALF_OPEN), then recordSuccess
      expect(breaker.isOpen('provider-a')).toBe(false);
      expect(breaker.getState('provider-a')).toBe('HALF_OPEN');

      breaker.recordSuccess('provider-a');
      expect(breaker.getState('provider-a')).toBe('CLOSED');
      expect(breaker.isOpen('provider-a')).toBe(false);
    });

    it('recordFailure transitions to OPEN (probe failed, cooldown resets)', () => {
      // Open the circuit
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');

      // Wait for cooldown
      vi.advanceTimersByTime(5 * 60_000);

      // Probe: isOpen returns false (HALF_OPEN)
      expect(breaker.isOpen('provider-a')).toBe(false);
      expect(breaker.getState('provider-a')).toBe('HALF_OPEN');

      // Probe fails
      breaker.recordFailure('provider-a');
      expect(breaker.getState('provider-a')).toBe('OPEN');

      // Should still be open (cooldown reset)
      expect(breaker.isOpen('provider-a')).toBe(true);
    });
  });

  describe('per-provider isolation', () => {
    it('each providerId has independent circuit state', () => {
      // provider-a fails 3 times → open
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(true);

      // provider-b has no failures → still closed
      expect(breaker.getState('provider-b')).toBe('CLOSED');
      expect(breaker.isOpen('provider-b')).toBe(false);

      // provider-c has 1 failure → still closed
      breaker.recordFailure('provider-c');
      expect(breaker.isOpen('provider-c')).toBe(false);
    });
  });

  describe('getState', () => {
    it('returns current state for diagnostics', () => {
      expect(breaker.getState('unknown')).toBe('CLOSED');
      expect(breaker.getState('new-provider')).toBe('CLOSED');

      breaker.recordFailure('test-p');
      expect(breaker.getState('test-p')).toBe('CLOSED');

      breaker.recordFailure('test-p');
      breaker.recordFailure('test-p');
      expect(breaker.getState('test-p')).toBe('OPEN');
    });
  });

  describe('reset', () => {
    it('reset restores circuit to CLOSED with empty failures', () => {
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      breaker.recordFailure('provider-a');
      expect(breaker.isOpen('provider-a')).toBe(true);

      breaker.reset('provider-a');
      expect(breaker.getState('provider-a')).toBe('CLOSED');
      expect(breaker.isOpen('provider-a')).toBe(false);
    });

    it('reset on uninitialized provider is a no-op', () => {
      expect(() => breaker.reset('nonexistent')).not.toThrow();
    });
  });
});
