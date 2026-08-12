// tests/core/context/ContextProvenanceManifest.test.ts — Wave-2 provenance
// contract suite (04-03). Contract under test (04-03-PLAN.md tasks 1-2):
//   1. ContextProvenanceManifestSchema (GR-4 Zod boundary gate, ProviderConfigSchema
//      precedent) parses every fixture-produced manifest and REJECTS unknown
//      section kinds (T-04-13) — the fixture builder (synced in Task 1) emits
//      the full D-04-17 enumeration with deterministic constants.
//   2. D-04-18 kind-lockstep guard (03a-01 precedent): manifest.sections[].kind
//      mirrors PromptSection['kind'] INCLUDING 'tool_result' — a new
//      PromptSection kind landing without a schema update fails this test
//      (runtime union-member parity; RESEARCH L369-377 shape verbatim).
//   3. stepsFired vocabulary matches the D-04-12 8-step ladder — compared
//      against the LITERAL array (NOT ContextCompressor.LADDER_STEPS: 04-02
//      runs in the same wave in parallel; the literal mirrors it).
//
// Determinism rule (fixtures/index.ts precedent): no Date.now, no crypto, no
// Math.random — every input and expected value is fixed.
import { describe, expect, it } from 'vitest';

import { ContextProvenanceManifestSchema } from '@/core/context/ContextProvenanceManifest';
import type { PromptSection } from '@/core/ai/types';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

const ALL_TIERS = ['tiny', 'small', 'medium', 'large'] as const;

/** The D-04-12 8-step ladder vocabulary — literal mirror of LADDER_STEPS (04-02). */
const LADDER_STEPS_LITERAL = [
  'drop-debug',
  'drop-secondary',
  'summarise-history',
  'compress-page',
  'trim-tools',
  'reduce-topk',
  'minimal-mode',
  'too-large',
] as const;

describe('ContextProvenanceManifestSchema (04-03 Task 2 — GR-4 Zod boundary)', () => {
  it('parses the fixture provenance for every tier override', () => {
    for (const tier of ALL_TIERS) {
      const { provenance } = buildOptimizedContextFixture({ tier });
      const parsed = ContextProvenanceManifestSchema.safeParse(provenance);
      expect(parsed.success).toBe(true);
    }
  });

  it('accepts a hand-built manifest with fired ladder steps', () => {
    const { provenance } = buildOptimizedContextFixture();
    const withSteps = {
      ...provenance,
      stepsFired: ['drop-debug', 'trim-tools', 'minimal-mode'],
    };
    expect(ContextProvenanceManifestSchema.safeParse(withSteps).success).toBe(true);
  });

  it('rejects a manifest whose section kind is not in the union (unknown kind)', () => {
    const { provenance } = buildOptimizedContextFixture();
    const bad = {
      ...provenance,
      sections: [{ kind: 'history', sourceId: 'invented', tokens: 1, truncated: false }],
    };
    const parsed = ContextProvenanceManifestSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'sections.0.kind')).toBe(true);
    }
  });

  it('rejects a manifest with a non-integer / negative token count', () => {
    const { provenance } = buildOptimizedContextFixture();
    const bad = {
      ...provenance,
      totalTokens: -1,
      sections: provenance.sections.map((s, i) => (i === 0 ? { ...s, tokens: 1.5 } : s)),
    };
    expect(ContextProvenanceManifestSchema.safeParse(bad).success).toBe(false);
  });
});

describe('D-04-18 kind-lockstep guard (04-03 Task 2 — runtime union parity)', () => {
  it('manifest kind union mirrors PromptSection kind union (incl. tool_result)', () => {
    const manifestKinds = new Set(
      ContextProvenanceManifestSchema.shape.sections.element.shape.kind.options,
    );
    const sectionKinds = new Set<PromptSection['kind']>([
      'system',
      'tool_schemas',
      'preferences',
      'memory',
      'context',
      'task',
      'user_input',
      'tool_result',
    ]);
    expect(manifestKinds).toEqual(sectionKinds);
  });

  it('the schema kind enum lists exactly the 8 PromptSection kinds', () => {
    const options = ContextProvenanceManifestSchema.shape.sections.element.shape.kind.options;
    expect(options).toHaveLength(8);
    expect(options).toContain('tool_result');
  });
});

describe('stepsFired vocabulary (04-03 Task 2 — D-04-12 lockstep)', () => {
  it('schema stepsFired enum options match the literal 8-step ladder vocabulary', () => {
    const manifestSteps = new Set(ContextProvenanceManifestSchema.shape.stepsFired.element.options);
    expect(manifestSteps).toEqual(new Set(LADDER_STEPS_LITERAL));
  });

  it('accepts an empty stepsFired array (no degradation) and rejects unknown steps', () => {
    const { provenance } = buildOptimizedContextFixture();
    expect(ContextProvenanceManifestSchema.safeParse(provenance).success).toBe(true); // stepsFired: []
    expect(
      ContextProvenanceManifestSchema.safeParse({ ...provenance, stepsFired: ['invented-step'] })
        .success,
    ).toBe(false);
  });
});
