// tests/core/context/trust/qualityCounters.test.ts — 04b-03 Task 2: CTX-06
// counters + the extended ContextProvenanceManifestSchema (GR-4 lockstep).
// Contract under test:
//   1. The extended schema parses a manifest carrying receipt + counters
//      (positive gate — the fixture builder syncs the new REQUIRED fields).
//   2. Counters shape: screened/quarantined/byTrust (exactly the 5 TrustLevel
//      keys)/totalIncludedTokens present and numeric.
//   3. R-10: buildReceipt-derived counters/receipt carry counts + ids only,
//      never the source body (T-4b-07).
//
// Determinism rule (fixtures precedent): no Date.now, no crypto, no
// Math.random.
import { describe, expect, it } from 'vitest';

import { ContextProvenanceManifestSchema } from '@/core/context/ContextProvenanceManifest';
import { buildReceipt } from '@/core/context/contextReceipt';
import type { ContextItem } from '@/types/harness';
import { buildOptimizedContextFixture } from '../../../fixtures/optimizedContext';

/** Distinct body marker — the R-10 negative probe (must never reach counters). */
const SOURCE_BODY = 'SUPER_SECRET_PAGE_BODY_42_NEVER_IN_COUNTERS';

/** Fixed untrusted-kind fixture (the quarantine-stage input shape). */
function untrustedItem(id: string, text: string): ContextItem {
  return {
    id,
    kind: 'memory',
    text,
    tokens: 9,
    trust: 'untrusted',
    instructionAuthority: false,
    relevance: 0.5,
    freshness: 0.2,
    sensitivity: 'none',
    sourceId: id,
  };
}

describe('extended ContextProvenanceManifestSchema (GR-4 lockstep — receipt + counters)', () => {
  it('parses the synced fixture provenance with empty receipt + zeroed counters (positive gate)', () => {
    const { provenance } = buildOptimizedContextFixture();
    expect(provenance.receipt).toEqual([]);
    expect(provenance.counters).toEqual({
      screened: 0,
      quarantined: 0,
      byTrust: { system: 0, user: 0, tool: 0, retrieved: 0, untrusted: 0 },
      totalIncludedTokens: 0,
    });
    expect(ContextProvenanceManifestSchema.safeParse(provenance).success).toBe(true);
  });

  it('parses a manifest carrying a real receipt + non-zero counters', () => {
    const { provenance } = buildOptimizedContextFixture();
    const withCounters = {
      ...provenance,
      receipt: [
        {
          sourceId: 'https://docs.example.com/article',
          included: true,
          originalTokens: 42,
          finalTokens: 48,
          cacheEligible: false,
        },
        {
          sourceId: 'mem-bad',
          included: false,
          originalTokens: 9,
          finalTokens: 0,
          cacheEligible: true,
          omitReason: 'prompt_injection',
        },
      ],
      counters: {
        screened: 3,
        quarantined: 1,
        byTrust: { system: 0, user: 0, tool: 0, retrieved: 2, untrusted: 1 },
        totalIncludedTokens: 48,
      },
    };
    expect(ContextProvenanceManifestSchema.safeParse(withCounters).success).toBe(true);
  });

  it('rejects a legacy manifest missing the new receipt/counters fields (negative gate)', () => {
    const { provenance } = buildOptimizedContextFixture();
    const { receipt: _receipt, counters: _counters, ...legacy } = provenance;
    const parsed = ContextProvenanceManifestSchema.safeParse(legacy);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'receipt')).toBe(true);
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'counters')).toBe(true);
    }
  });
});

describe('CTX-06 counters shape (D-4b-14)', () => {
  it('screened/quarantined/byTrust (exactly 5 TrustLevel keys)/totalIncludedTokens present + numeric', () => {
    const { provenance } = buildOptimizedContextFixture();
    const c = provenance.counters;
    expect(typeof c.screened).toBe('number');
    expect(typeof c.quarantined).toBe('number');
    expect(typeof c.totalIncludedTokens).toBe('number');
    expect(Object.keys(c.byTrust).sort()).toEqual(['retrieved', 'system', 'tool', 'untrusted', 'user']);
    for (const v of Object.values(c.byTrust)) {
      expect(typeof v).toBe('number');
    }
    // the schema's int().nonnegative() gates hold for the zeroed fixture
    expect(ContextProvenanceManifestSchema.safeParse(provenance).success).toBe(true);
  });
});

describe('R-10 — counters/receipt never carry the source body (T-4b-07)', () => {
  it('a buildReceipt-derived counters + receipt JSON lacks every body substring', () => {
    const bad = untrustedItem('mem-bad', SOURCE_BODY);
    const result = buildReceipt(
      [bad],
      { excluded: new Map<string, { reason: 'prompt_injection' }>([['mem-bad', { reason: 'prompt_injection' }]]) },
      () => false,
      1,
      1,
    );
    const json = JSON.stringify({ receipt: result.receipt, counters: result.counters });
    expect(json).not.toContain(SOURCE_BODY);
    // auditability preserved: sourceId + omit reason ARE present
    expect(json).toContain('mem-bad');
    expect(json).toContain('prompt_injection');
  });
});
