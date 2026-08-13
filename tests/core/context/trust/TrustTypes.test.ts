// tests/core/context/trust/TrustTypes.test.ts — Wave-1 trust type boundary
// suite (04b-01, Task 1). Contract under test:
//   1. ContextItemSchema / ContextReceiptEntrySchema (GR-4 Zod boundary gates,
//      D-3a-20 precedent) accept the C.1 verbatim shapes and REJECT unknown
//      kinds/trusts and out-of-range relevance (negative gates — the
//      ContextProvenanceManifest.test.ts L55-66 issue-path assertion pattern).
//   2. CTX-01 MUST-be-false invariant: instructionAuthority:true with trust
//      'tool'/'retrieved'/'untrusted' FAILS the boundary; the same item with
//      instructionAuthority:false passes.
//   3. CTX-05 seam (D-4b-13): the optional disclosureReady field is accepted.
//   4. D-04-18 union parity: ContextItemSchema.shape.kind mirrors
//      PromptSection['kind'] — all 8 members INCLUDING 'tool_result' (03a-01
//      lockstep).
//
// Determinism rule (fixtures precedent): no Date.now, no crypto, no
// Math.random — every fixture and expected value is fixed.
import { describe, expect, it } from 'vitest';

import type { PromptSection } from '@/core/ai/types';
import {
  ContextItemSchema,
  ContextReceiptEntrySchema,
  TrustOmitReasonSchema,
} from '@/types/harness';

/** Fixed C.1-valid ContextItem fixture (deterministic — no dynamic values). */
const VALID_CONTEXT_ITEM = {
  id: 'page:https://example.com/article',
  kind: 'context',
  text: 'Fixed page excerpt used as a deterministic fixture.',
  tokens: 12,
  trust: 'retrieved',
  instructionAuthority: false,
  relevance: 0.9,
  freshness: 0.5,
  sensitivity: 'none',
  sourceId: 'https://example.com/article',
} as const;

/** Fixed C.1-valid ContextReceiptEntry fixture. */
const VALID_RECEIPT_ENTRY = {
  sourceId: 'https://example.com/article',
  included: true,
  originalTokens: 12,
  finalTokens: 16,
  cacheEligible: false,
} as const;

describe('ContextItemSchema / ContextReceiptEntrySchema (04b-01 Task 1 — GR-4 Zod boundary)', () => {
  it('accepts a valid C.1 ContextItem fixture (positive gate)', () => {
    const parsed = ContextItemSchema.safeParse(VALID_CONTEXT_ITEM);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.trust).toBe('retrieved');
      expect(parsed.data.instructionAuthority).toBe(false);
    }
  });

  it('accepts a valid C.1 ContextReceiptEntry fixture (positive gate)', () => {
    const parsed = ContextReceiptEntrySchema.safeParse(VALID_RECEIPT_ENTRY);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.included).toBe(true);
    }
  });

  it('accepts a receipt entry with compression + omitReason', () => {
    const parsed = ContextReceiptEntrySchema.safeParse({
      ...VALID_RECEIPT_ENTRY,
      compression: 'summarise',
      omitReason: 'prompt_injection',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unknown ContextItem kind (negative gate)', () => {
    const bad = { ...VALID_CONTEXT_ITEM, kind: 'history' };
    const parsed = ContextItemSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'kind')).toBe(true);
    }
  });

  it('rejects an unknown trust level (negative gate)', () => {
    const bad = { ...VALID_CONTEXT_ITEM, trust: 'suspicious' };
    const parsed = ContextItemSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'trust')).toBe(true);
    }
  });

  it('rejects an out-of-range relevance value (negative gate)', () => {
    const bad = { ...VALID_CONTEXT_ITEM, relevance: 1.5 };
    const parsed = ContextItemSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'relevance')).toBe(true);
    }
  });
});

describe('CTX-01 MUST-be-false invariant (boundary refine)', () => {
  it.each(['tool', 'retrieved', 'untrusted'] as const)(
    'rejects instructionAuthority:true with trust %s',
    (trust) => {
      const forged = { ...VALID_CONTEXT_ITEM, trust, instructionAuthority: true };
      const parsed = ContextItemSchema.safeParse(forged);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.path.join('.') === 'instructionAuthority')).toBe(
          true,
        );
      }
    },
  );

  it('accepts instructionAuthority:true for system and user trust', () => {
    for (const trust of ['system', 'user'] as const) {
      const item = { ...VALID_CONTEXT_ITEM, trust, instructionAuthority: true };
      expect(ContextItemSchema.safeParse(item).success).toBe(true);
    }
  });

  it('accepts the same retrieved item with instructionAuthority:false', () => {
    expect(ContextItemSchema.safeParse(VALID_CONTEXT_ITEM).success).toBe(true);
  });
});

describe('CTX-05 disclosureReady seam (D-4b-13, type-level only)', () => {
  it('accepts a fixture with disclosureReady: true', () => {
    const item = { ...VALID_CONTEXT_ITEM, disclosureReady: true };
    const parsed = ContextItemSchema.safeParse(item);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.disclosureReady).toBe(true);
    }
  });
});

describe('D-04-18 kind-lockstep guard (04b-01 Task 1 — runtime union parity)', () => {
  it('ContextItem kind union mirrors PromptSection kind union (incl. tool_result)', () => {
    const itemKinds = new Set(ContextItemSchema.innerType().shape.kind.options);
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
    expect(itemKinds).toEqual(sectionKinds);
  });

  it('the schema kind enum lists exactly the 8 PromptSection kinds', () => {
    const options = ContextItemSchema.innerType().shape.kind.options;
    expect(options).toHaveLength(8);
    expect(options).toContain('tool_result');
  });
});

describe('TrustOmitReasonSchema (Open Q3 resolution — structured omit reasons)', () => {
  it('accepts both canonical omit reasons', () => {
    expect(TrustOmitReasonSchema.safeParse('prompt_injection').success).toBe(true);
    expect(TrustOmitReasonSchema.safeParse('trust_disabled').success).toBe(true);
  });

  it('rejects an unknown omit reason', () => {
    expect(TrustOmitReasonSchema.safeParse('invented_reason').success).toBe(false);
  });
});
