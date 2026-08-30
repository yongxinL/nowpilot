// TrustPolicy — D-93/D-99 O.3-verbatim instruction-authority policy
// (PRODUCT_SPEC_v0_1.md Appendix O.3, spec 6363-6389).
//
// AUTHORITY_BY_TRUST (spec 6371) is the closed authority map: only system/user
// items may carry instruction authority. applyTrustPolicy (spec 6373-6384)
// wraps any item claiming authority it must not have in
// <untrusted_data source=…> and force-strips instructionAuthority — the
// ADR-SEC-01 layer-5 containment seam (D-98). The wrap adds prompt overhead,
// so tokens are RECOUNTED post-wrap (D-96 bookkeeping, RESEARCH Pattern 1) via
// countTokensHeuristic (TokenBudget.ts:44-55 — the shipped accounting unit).
//
// The structural guard (D-99/P7) keys on the C.1 field combination
// trust ∈ {retrieved, untrusted} ∧ instructionAuthority === true — NEVER
// content matching (no item.text inspection; content heuristics were subverted
// in production, PITFALLS P7). raiseIfPolicyRedefinitionAttempt raises the
// closed-set code CONTEXT_INSTRUCTION_INJECTION_BLOCKED (spec 5093 — no
// invented codes, D-38) and is the test/consumer seam: assemble() never throws
// (never-throw AssembleResult contract, RESEARCH Pitfall 2).
import type { ContextItem, TrustLevel } from '@/types/harness';
import { countTokensHeuristic } from '../TokenBudget';

/** O.3 closed authority map (spec 6371) — the CTX-02 enforcement precondition. */
export const AUTHORITY_BY_TRUST: Record<TrustLevel, boolean> = {
  system: true,
  user: true,
  tool: false,
  retrieved: false,
  untrusted: false,
};

/**
 * O.3 applyTrustPolicy (spec 6373-6384) + post-wrap token recount (D-96).
 *
 * Any item whose trust maps to false authority while claiming instruction
 * authority is wrapped so the model treats its text as quoted DATA, never a
 * directive. Pipeline-correct items (authority:false on retrieved/untrusted,
 * or allowed authority on system/user) pass through unchanged — the `&& !allowed`
 * guard means correct items are never wrapped. Non-throwing: assemble() calls
 * only this function (never the raising guard).
 */
export function applyTrustPolicy(items: ContextItem[]): ContextItem[] {
  return items.map((it) => {
    const allowed = AUTHORITY_BY_TRUST[it.trust];
    if (it.instructionAuthority && !allowed) {
      const wrapped = `<untrusted_data source="${it.sourceId}">\n${it.text}\n</untrusted_data>`;
      return {
        ...it,
        instructionAuthority: false,
        text: wrapped,
        tokens: countTokensHeuristic(wrapped),
      };
    }
    return it;
  });
}

/**
 * Structural policy-redefinition detection (D-99/P7) — the C.1 field
 * combination trust ∈ {retrieved, untrusted} ∧ instructionAuthority === true.
 * Never inspects item.text (no content heuristics).
 */
export function isPolicyRedefinitionAttempt(item: ContextItem): boolean {
  return (
    (item.trust === 'retrieved' || item.trust === 'untrusted') &&
    item.instructionAuthority === true
  );
}

/**
 * Throwing guard — test/consumer seam (RESEARCH Pitfall 2). Raises the
 * closed-set code CONTEXT_INSTRUCTION_INJECTION_BLOCKED (spec 5093, D-38) with
 * a message naming the offending sourceId. assemble() must NOT call this.
 */
export function raiseIfPolicyRedefinitionAttempt(items: ContextItem[]): void {
  const offender = items.find(isPolicyRedefinitionAttempt);
  if (offender) {
    throw Object.assign(
      new Error(`policy redefinition attempted by source ${offender.sourceId}`),
      { code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED' },
    );
  }
}