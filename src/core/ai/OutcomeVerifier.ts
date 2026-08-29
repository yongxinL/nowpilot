// OutcomeVerifier — Appendix O.2 (PRODUCT_SPEC_v0_1.md:6330-6361), verbatim
// shape. No side effect may be reported as success without matching evidence
// (AGT-02).
//
// D-64: Phase 4 registers ZERO verifiers (matching D-46 zero tools) — real
// postcondition verifiers land with their owning phases (Phase 18, TOL-03 /
// ToolCapabilityManifest). The framework is exercised by injected fixtures
// only (D-67). The `reasonCode`s produced here ('cap_exhausted' /
// 'postcondition_failed' / 'ok') are descriptive literals, NOT §21.6 error
// codes — do not export them as error-code constants (D-38).
import type { AgentTurnOutcome, CompletionEvidence } from '@/types/harness';
import type { ToolExecutionResult } from './types';

/** A postcondition verifier, keyed by toolName (TOL-03 id + verify()). */
export interface Verifier {
  postconditionId: string;
  verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }>;
}

/**
 * O.2 verbatim (spec 6330-6361): compute the turn's honest outcome from its
 * accumulated tool results + the effective verifier set + the tier-cap state.
 *
 * Status rule (AGT-03): `caps.capHit ? 'partial' : sideEffectFailed ?
 * 'failed' : 'completed'` — cap exhaustion is NEVER 'completed'. Evidence is
 * produced only for tools with a registered verifier (read-only tools need no
 * postcondition); every evidence entry carries the verifier's postconditionId
 * and the input operationId.
 */
export async function buildOutcome(
  operationId: string,
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>, // keyed by toolName
  caps: { plannerCalls: number; toolCalls: number; capHit: boolean },
): Promise<AgentTurnOutcome> {
  const evidence: CompletionEvidence[] = [];
  for (const r of results) {
    const v = verifiers[r.toolName];
    if (!v) continue; // read-only tool: no postcondition required
    const outcome = await v.verify(r);
    evidence.push({
      toolName: r.toolName,
      operationId,
      postconditionId: v.postconditionId,
      ok: outcome.ok,
      verifiedAt: Date.now(),
      detail: outcome.detail,
    });
  }
  const sideEffectFailed = evidence.some((e) => !e.ok);
  const status: AgentTurnOutcome['status'] =
    caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'; // AGT-03: cap = partial
  return {
    operationId,
    status,
    reasonCode: caps.capHit ? 'cap_exhausted' : sideEffectFailed ? 'postcondition_failed' : 'ok',
    evidence,
    plannerCalls: caps.plannerCalls,
    toolCalls: caps.toolCalls,
  };
}

/**
 * D-64 declare-now registry (mirrors ToolRegistry in toolSchemas.ts) —
 * Map-backed register/unregister/get/getAll, starts EMPTY in Phase 4.
 * `runAgentTurn`'s effective verifier set = `{ ...VerifierRegistry.getAll(),
 * ...input.verifiers }` (the input override is the D-67 test-injection seam).
 */
const registeredVerifiers = new Map<string, Verifier>(); // keyed by toolName

export const VerifierRegistry = {
  register(toolName: string, verifier: Verifier): void {
    registeredVerifiers.set(toolName, verifier);
  },
  unregister(toolName: string): void {
    registeredVerifiers.delete(toolName);
  },
  get(toolName: string): Verifier | undefined {
    return registeredVerifiers.get(toolName);
  },
  getAll(): Record<string, Verifier> {
    return Object.fromEntries(registeredVerifiers);
  },
};

/**
 * D-65 guard condition (AGT-02, risk R-8): returns true when any result has
 * `ok === true` AND a postcondition verifier is registered for its toolName
 * (verifier presence = side-effecting, TOL-03) AND the result carries no
 * `evidence` — the executor skipped the postcondition verifier. True → the
 * outcome must never be 'completed' ("never silently claims success").
 *
 * The guard WIRING into finish() is plan 04-02; this helper ships and is
 * tested here (the false-completion proof, RESEARCH Pitfall 4).
 */
export function guardMissingEvidence(
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>,
): boolean {
  return results.some(
    (r) => r.ok === true && verifiers[r.toolName] !== undefined && r.evidence === undefined,
  );
}