// src/core/ai/OutcomeVerifier.ts — Source: PRODUCT_SPEC Appendix O.2 VERBATIM
// (lines 6362-6393) — "No side effect may be reported as success without
// matching evidence (AGT-02)". Phase 3a (03a-02): the deterministic evidence
// machinery. buildOutcome is the SINGLE, spec-verbatim place where a turn's
// tool results become CompletionEvidence and a terminal AgentTurnOutcome
// status — keeping cap exhaustion honest ('partial' never 'completed',
// D-3a-07/AGT-03) and side-effecting success evidence-gated (fail-closed,
// D-3a-06, R-8).
//
// D-3a-03 [deterministic verifier]: ZERO model calls, no verifier PipelineStage,
// no extra tier cap, no persona injection — a healthy turn stays at 2 model
// calls (planner + renderer). Verifier = verdict only ({ok, detail}); the
// orchestrator (03a-03) is the sole terminal decision authority (D-3a-05).
//
// D-3a-04 [evidence gates tool-turns only]: read-only tools with no registered
// verifier are SKIPPED (`if (!v) continue`), so a pure-answer turn is
// `completed` with `evidence: []`.
//
// Pitfall 6 [determinism]: the ONLY deviation from O.2's verbatim body is the
// injectable clock `now: () => number = Date.now` used for `verifiedAt`
// (flagged_assumptions 03a-02). The production default preserves the O.2
// Date.now() behavior; tests inject a fixed clock so equality assertions stay
// deterministic. No free-form error strings here (GR-9) — verifier failures
// surface via buildOutcome's structured verdict; the orchestrator logs the
// canonical codes.
import type { CompletionEvidence, AgentTurnOutcome } from '@/types/harness';
import type { ToolExecutionResult } from './types';

export interface Verifier {
  postconditionId: string;
  verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }>;
}

export async function buildOutcome(
  operationId: string,
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>, // keyed by toolName
  caps: { plannerCalls: number; toolCalls: number; capHit: boolean },
  now: () => number = Date.now,
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
      verifiedAt: now(),
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
