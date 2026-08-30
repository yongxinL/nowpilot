import { describe, it, expect } from 'vitest';
import {
  deriveContextQualityMetrics,
  type ContextQualityMetrics,
} from '@/core/context/trust/ContextQualityMetrics';
import type { ContextProvenanceManifest } from '@/core/context/ContextProvenanceManifest';
import type { ContextItem, TrustLevel } from '@/types/harness';
import type { ContextReceiptSurface } from '@/core/context/trust/ContextReceipt';

/**
 * ContextQualityMetrics tests (plan 07-02, Task 1) — §18-required
 * tests/core/context/trust/ContextQualityMetrics.test.ts. Pure unit, no chrome
 * mocks (ContextReceipt.test.ts conventions): the CTX-06/D-102 aggregate
 * derivation rules — sectionCount, per-TrustLevel trustMix (all five keys), the
 * manifestTruncatedSources truncation filter (system/task excluded), omission/
 * compression counts, the token utilization ratio (Σfinal/Σoriginal, 4dp, 1 for
 * an empty receipt), minimalMode mirroring, and the D-102 HARD BOUNDARY: the
 * serialized metrics contain no fixture section-body text
 * (SECRET_PAGE_BODY_XYZ marker).
 */

const pageUrl = 'https://example.com/incident';

/** Fixture page body — the D-102 no-leak marker lives ONLY in the item text,
 * never in the metrics shape. */
const SECRET_PAGE_BODY = 'SECRET_PAGE_BODY_XYZ: the on-call DB team pager number is 555-0199.';

/** Hand-built manifest mirroring buildManifest output (schema verbatim — the
 * metrics derive from it, never edit it). context + memory are genuinely
 * degraded (truncated + compressionApplied); system/task are the by-design
 * omission records. */
function makeManifest(overrides: Partial<ContextProvenanceManifest> = {}): ContextProvenanceManifest {
  return {
    sections: [
      { kind: 'tool_schemas', sourceId: 'alpha', tokens: 100, truncated: false },
      { kind: 'preferences', sourceId: 'preferences', tokens: 100, truncated: false },
      { kind: 'memory', sourceId: 'm1', tokens: 20, truncated: true, compressionApplied: 'topk' },
      {
        kind: 'context',
        sourceId: pageUrl,
        tokens: 80,
        truncated: true,
        compressionApplied: 'structural',
      },
      { kind: 'user_input', sourceId: 'user_input', tokens: 100, truncated: false },
      { kind: 'system', sourceId: 'system', tokens: 0, truncated: true },
      { kind: 'task', sourceId: 'task', tokens: 0, truncated: true },
    ],
    totalTokens: 400,
    minimalMode: false,
    workspaceId: 'ws-1',
    activeSurface: 'sidepanel',
    ...overrides,
  };
}

/** Hand-built receipt surface mirroring the manifest: 5 shipped entries
 * (original 100 each = 500) with memory/context compressed (finals 20/80 =
 * 100) plus the two system/task omissions (included:false, 0/0) → ratio
 * 400/500 = 0.8. */
function makeReceipt(): ContextReceiptSurface {
  return {
    entries: [
      { sourceId: 'alpha', included: true, originalTokens: 100, finalTokens: 100, cacheEligible: true },
      { sourceId: 'preferences', included: true, originalTokens: 100, finalTokens: 100, cacheEligible: false },
      { sourceId: 'm1', included: true, originalTokens: 100, finalTokens: 20, compression: 'topk', cacheEligible: false },
      { sourceId: pageUrl, included: true, originalTokens: 100, finalTokens: 80, compression: 'structural', cacheEligible: false },
      { sourceId: 'user_input', included: true, originalTokens: 100, finalTokens: 100, cacheEligible: false },
      { sourceId: 'system', included: false, originalTokens: 0, finalTokens: 0, cacheEligible: false, omitReason: 'no-input-source' },
      { sourceId: 'task', included: false, originalTokens: 0, finalTokens: 0, cacheEligible: false, omitReason: 'no-input-source' },
    ],
    untrustedDataPresent: true,
  };
}

/** makeItem — valid ContextItem defaults, overrides merge (ContextReceipt.test
 * conventions). The D-102 marker rides the untrusted CONTEXT item text. */
function makeItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: `CONTEXT:${pageUrl}`,
    kind: 'CONTEXT',
    text: `URL: ${pageUrl}\nTITLE: Incident\n${SECRET_PAGE_BODY}`,
    tokens: 80,
    trust: 'untrusted',
    instructionAuthority: false,
    relevance: 1,
    freshness: 1,
    sensitivity: 'high',
    sourceId: pageUrl,
    ...overrides,
  };
}

/** The 5-item trust-mix fixture: 1 system + 1 user + 2 retrieved + 1 untrusted
 * + 0 tool → exact map (CTX-06 Contract B). */
function makeItems(): ContextItem[] {
  return [
    { id: 'TOOL SCHEMAS:alpha', kind: 'TOOL SCHEMAS', text: 'alpha\tdesc', tokens: 100, trust: 'system', instructionAuthority: true, relevance: 1, freshness: 1, sensitivity: 'none', sourceId: 'alpha' },
    { id: 'USER INPUT:user_input', kind: 'USER INPUT', text: 'Summarize', tokens: 100, trust: 'user', instructionAuthority: true, relevance: 1, freshness: 1, sensitivity: 'low', sourceId: 'user_input' },
    { id: 'MEMORY:m1', kind: 'MEMORY', text: 'm1\tprefers concise', tokens: 100, trust: 'retrieved', instructionAuthority: false, relevance: 0.9, freshness: 0.5, sensitivity: 'high', sourceId: 'm1' },
    { id: 'MEMORY:m2', kind: 'MEMORY', text: 'm2\tescalation path', tokens: 100, trust: 'retrieved', instructionAuthority: false, relevance: 0.7, freshness: 0.5, sensitivity: 'high', sourceId: 'm2' },
    makeItem(),
  ];
}

describe('deriveContextQualityMetrics — CTX-06/D-102 aggregate derivation (UI-SPEC Contract B)', () => {
  it('sectionCount mirrors manifest.sections.length (all 7 records incl. system/task omissions)', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    expect(metrics.sectionCount).toBe(7);
  });

  it('trustMix counts each TrustLevel across a mixed item set — 1 system + 1 user + 2 retrieved + 1 untrusted + 0 tool', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    expect(metrics.trustMix).toEqual({
      system: 1,
      user: 1,
      tool: 0,
      retrieved: 2,
      untrusted: 1,
    });
  });

  it('truncationCount excludes the by-design system/task omissions but includes genuinely truncated CONTEXT/MEMORY records', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    // context + memory are truncated:true with non-system/task sourceIds → 2;
    // system/task are also truncated:true but excluded (manifestTruncatedSources).
    expect(metrics.truncationCount).toBe(2);
  });

  it('omissionCount equals receipt entries with included:false (the two by-design omissions)', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    expect(metrics.omissionCount).toBe(2);
    expect(makeReceipt().entries.filter((e) => !e.included)).toHaveLength(2);
  });

  it('compressionCount counts only records carrying compressionApplied (topk + structural)', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    expect(metrics.compressionCount).toBe(2);
  });

  it('tokenUtilizationRatio = Σ final / Σ original rounded to 4dp — 400/500 → 0.8', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    expect(metrics.tokenUtilizationRatio).toBe(0.8);
  });

  it('tokenUtilizationRatio is 1 for an empty receipt (never NaN — zero-divisor guarded)', () => {
    const emptyReceipt: ContextReceiptSurface = { entries: [], untrustedDataPresent: false };
    const metrics = deriveContextQualityMetrics(makeManifest(), emptyReceipt, makeItems());
    expect(metrics.tokenUtilizationRatio).toBe(1);
    expect(Number.isNaN(metrics.tokenUtilizationRatio)).toBe(false);
  });

  it('minimalMode mirrors the manifest flag', () => {
    const normal = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    expect(normal.minimalMode).toBe(false);
    const minimal = deriveContextQualityMetrics(
      makeManifest({ minimalMode: true }),
      makeReceipt(),
      makeItems(),
    );
    expect(minimal.minimalMode).toBe(true);
  });

  it('D-102 HARD BOUNDARY: the serialized metrics contain no fixture section-body text', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), makeItems());
    const serialized = JSON.stringify(metrics);
    // The marker lives only in the untrusted CONTEXT item text — it must never
    // cross into the diagnostics surface (aggregates only, no raw text).
    expect(serialized).not.toContain(SECRET_PAGE_BODY);
    expect(serialized).not.toContain('SECRET_PAGE_BODY_XYZ');
    expect(serialized).not.toContain('555-0199');
    // Sanity: the fixture item DOES carry the marker (the test proves the
    // boundary by showing the marker exists in the input, absent in the output).
    expect(makeItem().text).toContain(SECRET_PAGE_BODY);
  });

  it('empty items array → trustMix all zeros, still a valid shape', () => {
    const metrics = deriveContextQualityMetrics(makeManifest(), makeReceipt(), []);
    expect(metrics.trustMix).toEqual({ system: 0, user: 0, tool: 0, retrieved: 0, untrusted: 0 });
    const allKeysPresent = (['system', 'user', 'tool', 'retrieved', 'untrusted'] as TrustLevel[]).every(
      (level) => metrics.trustMix[level] === 0,
    );
    expect(allKeysPresent).toBe(true);
    expect(typeof metrics.sectionCount).toBe('number');
    expect(typeof metrics.tokenUtilizationRatio).toBe('number');
  });

  it('the metrics shape is the UI-SPEC Contract B aggregate set (no extra fields)', () => {
    const metrics: ContextQualityMetrics = deriveContextQualityMetrics(
      makeManifest(),
      makeReceipt(),
      makeItems(),
    );
    expect(Object.keys(metrics).sort()).toEqual([
      'compressionCount',
      'minimalMode',
      'omissionCount',
      'sectionCount',
      'tokenUtilizationRatio',
      'truncationCount',
      'trustMix',
    ]);
  });
});