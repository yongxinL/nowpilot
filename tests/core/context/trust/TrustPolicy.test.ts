import { describe, it, expect } from 'vitest';
import {
  AUTHORITY_BY_TRUST,
  applyTrustPolicy,
  isPolicyRedefinitionAttempt,
  raiseIfPolicyRedefinitionAttempt,
} from '@/core/context/trust/TrustPolicy';
import { countTokensHeuristic } from '@/core/context/TokenBudget';
import type { ContextItem } from '@/types/harness';

/**
 * TrustPolicy contract tests (plan 07-01, Task 1) — §18-required
 * tests/core/context/trust/TrustPolicy.test.ts. Pure unit, no chrome mocks
 * (ContextOptimizer.test.ts conventions): the O.3-verbatim wrap+strip
 * semantics (spec 6373-6384), the D-96 post-wrap token recount, and the
 * structural policy-redefinition guard (D-99/P7 — field combination only,
 * never content matching).
 */

/** makeItem — ContextOptimizer.test.ts makeInput style: valid defaults, overrides merge. */
function makeItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: 'item:1',
    kind: 'CONTEXT',
    text: 'plain body text',
    tokens: countTokensHeuristic('plain body text'),
    trust: 'untrusted',
    instructionAuthority: false,
    relevance: 1,
    freshness: 1,
    sensitivity: 'high',
    sourceId: 'https://evil.example/incident',
    ...overrides,
  };
}

describe('AUTHORITY_BY_TRUST — O.3 closed 5-entry map (spec 6371)', () => {
  it('maps exactly system/user → true and tool/retrieved/untrusted → false', () => {
    expect(AUTHORITY_BY_TRUST).toEqual({
      system: true,
      user: true,
      tool: false,
      retrieved: false,
      untrusted: false,
    });
  });
});

describe('applyTrustPolicy — O.3 wrap + force-strip (spec 6373-6384)', () => {
  it('wraps a retrieved item fabricating authority in <untrusted_data> and strips instructionAuthority', () => {
    const item = makeItem({ trust: 'retrieved', instructionAuthority: true });
    const [out] = applyTrustPolicy([item]);

    expect(out.instructionAuthority).toBe(false);
    expect(out.text).toBe(
      `<untrusted_data source="${item.sourceId}">\n${item.text}\n</untrusted_data>`,
    );
    // Non-mutating: the original item is untouched.
    expect(item.instructionAuthority).toBe(true);
  });

  it('wraps an untrusted item fabricating authority and strips instructionAuthority', () => {
    const item = makeItem({ trust: 'untrusted', instructionAuthority: true });
    const [out] = applyTrustPolicy([item]);

    expect(out.instructionAuthority).toBe(false);
    expect(out.text.startsWith(`<untrusted_data source="${item.sourceId}">`)).toBe(true);
    expect(out.text.endsWith('</untrusted_data>')).toBe(true);
  });

  it('leaves a system item with authority:true unchanged (allowed by the map)', () => {
    const item = makeItem({ trust: 'system', instructionAuthority: true, sourceId: 'TOOL SCHEMAS:toolA' });
    const [out] = applyTrustPolicy([item]);

    expect(out).toBe(item); // identity — no wrap, no strip, no recount
  });

  it('leaves a user item with authority:true unchanged', () => {
    const item = makeItem({ trust: 'user', instructionAuthority: true, sourceId: 'user_input' });
    const [out] = applyTrustPolicy([item]);

    expect(out).toBe(item);
  });

  it('leaves an already-correct retrieved item (authority:false) unchanged — the `&& !allowed` guard never wraps pipeline-correct items', () => {
    const item = makeItem({ trust: 'retrieved', instructionAuthority: false });
    const [out] = applyTrustPolicy([item]);

    expect(out).toBe(item);
  });

  it('recounts tokens post-wrap: wrapped tokens > original and equal countTokensHeuristic(wrappedText) (D-96)', () => {
    const item = makeItem({ trust: 'untrusted', instructionAuthority: true });
    const [out] = applyTrustPolicy([item]);

    const wrappedText = `<untrusted_data source="${item.sourceId}">\n${item.text}\n</untrusted_data>`;
    expect(out.tokens).toBe(countTokensHeuristic(wrappedText));
    expect(out.tokens).toBeGreaterThan(item.tokens);
  });
});

describe('isPolicyRedefinitionAttempt — structural field-combination detection (D-99/P7)', () => {
  it('returns true ONLY for trust ∈ {retrieved, untrusted} ∧ instructionAuthority === true', () => {
    expect(isPolicyRedefinitionAttempt(makeItem({ trust: 'retrieved', instructionAuthority: true }))).toBe(true);
    expect(isPolicyRedefinitionAttempt(makeItem({ trust: 'untrusted', instructionAuthority: true }))).toBe(true);
  });

  it('returns false for system/user/tool items carrying authority (authority is allowed there)', () => {
    expect(isPolicyRedefinitionAttempt(makeItem({ trust: 'system', instructionAuthority: true }))).toBe(false);
    expect(isPolicyRedefinitionAttempt(makeItem({ trust: 'user', instructionAuthority: true }))).toBe(false);
    expect(isPolicyRedefinitionAttempt(makeItem({ trust: 'tool', instructionAuthority: true }))).toBe(false);
  });

  it('returns false for pipeline-correct retrieved/untrusted items (authority:false)', () => {
    expect(isPolicyRedefinitionAttempt(makeItem({ trust: 'retrieved', instructionAuthority: false }))).toBe(false);
    expect(isPolicyRedefinitionAttempt(makeItem({ trust: 'untrusted', instructionAuthority: false }))).toBe(false);
  });
});

describe('raiseIfPolicyRedefinitionAttempt — typed closed-set guard (spec 5093, D-38)', () => {
  it('throws CONTEXT_INSTRUCTION_INJECTION_BLOCKED naming the offending sourceId', () => {
    const offender = makeItem({ trust: 'retrieved', instructionAuthority: true, sourceId: 'mem:note-42' });
    expect(() => raiseIfPolicyRedefinitionAttempt([makeItem(), offender])).toThrowError(
      'policy redefinition attempted by source mem:note-42',
    );
    try {
      raiseIfPolicyRedefinitionAttempt([offender]);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as any).code).toBe('CONTEXT_INSTRUCTION_INJECTION_BLOCKED');
    }
  });

  it('does not throw when no item attempts policy redefinition', () => {
    expect(() =>
      raiseIfPolicyRedefinitionAttempt([
        makeItem({ trust: 'system', instructionAuthority: true }),
        makeItem({ trust: 'retrieved', instructionAuthority: false }),
      ]),
    ).not.toThrow();
  });
});