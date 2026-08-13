// tests/core/context/trust/TrustPolicy.test.ts — Wave-2 trust-policy suite
// (04b-02, Task 1). Contract under test:
//   1. applyTrustPolicy is O.3 verbatim (spec L6433-6459): system/user items
//      with instructionAuthority:true pass through BYTE-IDENTICAL (whole-object
//      toEqual); tool/retrieved/untrusted items with instructionAuthority:true
//      come back instructionAuthority:false with text EXACTLY
//      `<untrusted_data source="${sourceId}">\n${text}\n</untrusted_data>`
//      (byte-level, not regex).
//   2. No double-wrap: an item ALREADY instructionAuthority:false passes
//      through unmodified.
//   3. The CONTEXT_INSTRUCTION_INJECTION_BLOCKED typed carrier
//      (contextInjectionBlockedError) is recognized by the isContextInjectionBlockedError
//      guard; a plain Error and the CONTEXT_TOO_LARGE carrier are NOT
//      (ContextOptimizer.test.ts L145-158 guard-test precedent).
//   4. Determinism: identical input → deep-equal output arrays.
//
// Determinism rule (fixtures precedent): no Date.now, no crypto, no
// Math.random — every fixture and expected value is fixed.
import { describe, expect, it } from 'vitest';

import {
  applyTrustPolicy,
  contextInjectionBlockedError,
  isContextInjectionBlockedError,
} from '@/core/context/trust/TrustPolicy';
import type { ContextItem } from '@/types/harness';
import type { ContextTooLargeError } from '@/core/context/ContextOptimizer';

/** Build a fixed ContextItem fixture — trust/authority are the only varying knobs. */
function item(trust: ContextItem['trust'], instructionAuthority: boolean, sourceId = 'fixed-source'): ContextItem {
  return {
    id: `fixed:${sourceId}:${trust}`,
    kind: 'context',
    text: 'Fixed deterministic excerpt from the source.',
    tokens: 10,
    trust,
    instructionAuthority,
    relevance: 0.9,
    freshness: 0.5,
    sensitivity: 'none',
    sourceId,
  };
}

describe('applyTrustPolicy — O.3 authority strip (04b-02 Task 1, D-4b-04)', () => {
  it.each(['system', 'user'] as const)(
    'passes a %s item with instructionAuthority:true through BYTE-IDENTICAL',
    (trust) => {
      const original = item(trust, true, 'system-source');
      const result = applyTrustPolicy([original]);
      expect(result).toEqual([original]); // whole-object equality — untouched
    },
  );

  it.each(['tool', 'retrieved', 'untrusted'] as const)(
    'strips authority + wraps a %s item with instructionAuthority:true (exact wrap bytes)',
    (trust) => {
      const original = item(trust, true, 'source-page-1');
      const [wrapped] = applyTrustPolicy([original]);
      expect(wrapped.instructionAuthority).toBe(false);
      expect(wrapped.text).toBe(
        `<untrusted_data source="source-page-1">\n${original.text}\n</untrusted_data>`,
      );
      expect(wrapped.sourceId).toBe(original.sourceId);
      expect(wrapped.id).toBe(original.id);
      expect(wrapped.kind).toBe(original.kind);
    },
  );

  it('passes a retrieved item ALREADY instructionAuthority:false through UNMODIFIED (no double-wrap)', () => {
    const original = item('retrieved', false, 'already-clean');
    const [result] = applyTrustPolicy([original]);
    expect(result).toEqual(original);
    expect(result.text).toBe(original.text); // byte-identical — wrap happens exactly once
  });

  it('leaves an empty input as an empty output', () => {
    expect(applyTrustPolicy([])).toEqual([]);
  });
});

describe('CONTEXT_INSTRUCTION_INJECTION_BLOCKED typed carrier (O.3 L6457-6458)', () => {
  it('isContextInjectionBlockedError returns true for the builder output', () => {
    expect(isContextInjectionBlockedError(contextInjectionBlockedError())).toBe(true);
    expect(contextInjectionBlockedError().code).toBe('CONTEXT_INSTRUCTION_INJECTION_BLOCKED');
  });

  it('returns false for a plain Error', () => {
    expect(isContextInjectionBlockedError(new Error('some other error'))).toBe(false);
  });

  it('returns false for the CONTEXT_TOO_LARGE carrier (distinct canonical codes)', () => {
    const tooLarge = new Error('CONTEXT_TOO_LARGE') as ContextTooLargeError;
    tooLarge.code = 'CONTEXT_TOO_LARGE';
    tooLarge.reason = 'minimal_mode_exceeded';
    tooLarge.totalTokens = 9999;
    tooLarge.inputBudget = 100;
    expect(isContextInjectionBlockedError(tooLarge)).toBe(false);
  });

  it('returns false for a non-Error value', () => {
    expect(isContextInjectionBlockedError(undefined)).toBe(false);
    expect(isContextInjectionBlockedError({ code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED' })).toBe(false);
  });
});

describe('applyTrustPolicy — determinism (D-4b-03)', () => {
  it('two calls with identical input return deep-equal arrays', () => {
    const input = [
      item('system', true, 'system-source'),
      item('retrieved', true, 'page-source'),
      item('user', true, 'user-source'),
      item('tool', true, 'tool-source'),
      item('untrusted', false, 'note-source'),
    ];
    expect(applyTrustPolicy(input)).toEqual(applyTrustPolicy(input));
  });
});
