import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contextFreshnessPolicy } from '../../../src/core/context/ContextFreshnessPolicy';

// Fixed clock instant (D-10): all timestamps in this suite are relative to
// NOW, so decay math is fully deterministic — no wall-clock races.
const NOW = 1_800_000_000_000;

describe('ContextFreshnessPolicy.compute() — exponential decay (D-10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 1.0 for system sources (Infinity TTL — no decay)', () => {
    expect(contextFreshnessPolicy.compute('core.instructions.system', 'system', NOW - 86_400_000)).toBe(1.0);
  });

  it('returns 1.0 for persona sources (Infinity TTL — no decay)', () => {
    expect(contextFreshnessPolicy.compute('persona.injector.default', 'system', NOW - 3_600_000)).toBe(1.0);
  });

  it('returns Math.exp(-1) ≈ 0.3679 for a tool_result at ageMs === ttlMs (60s/60s)', () => {
    expect(contextFreshnessPolicy.compute('tools.builtin.search', 'tool_result', NOW - 60_000)).toBeCloseTo(
      Math.exp(-1),
      2,
    );
  });

  it('returns Math.exp(-0.5) ≈ 0.6065 for a tool_result at ageMs 30s / ttlMs 60s', () => {
    expect(contextFreshnessPolicy.compute('tools.builtin.search', 'tool_result', NOW - 30_000)).toBeCloseTo(
      Math.exp(-0.5),
      2,
    );
  });

  it('returns 0 when expiresAt has passed — hard expiry before decay per D-10', () => {
    expect(contextFreshnessPolicy.compute('tools.builtin.search', 'tool_result', NOW, NOW - 1)).toBe(0);
  });

  it('returns 1.0 when createdAt is undefined (no creation timestamp → assume fresh)', () => {
    expect(contextFreshnessPolicy.compute('tools.builtin.search', 'tool_result')).toBe(1.0);
  });

  it('returns a very small non-negative value for createdAt = 0 (asymptotic decay, never negative)', () => {
    const freshness = contextFreshnessPolicy.compute('unknown.source.xyz', 'context', 0);
    expect(freshness).toBeGreaterThanOrEqual(0);
    expect(freshness).toBeLessThan(1);
  });

  it('returns 1.0 for a page source at 0 age (maximum freshness)', () => {
    expect(contextFreshnessPolicy.compute('context.page.current-url', 'context', NOW)).toBe(1.0);
  });

  it('returns Math.exp(-0.5) for a memory fact at ageMs 30min / ttlMs 60min', () => {
    expect(contextFreshnessPolicy.compute('memory.user.facts', 'memory_fact', NOW - 1_800_000)).toBeCloseTo(
      Math.exp(-0.5),
      2,
    );
  });
});
