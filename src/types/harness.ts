/**
 * Canonical Phase-4 agent-reliability type home — Appendix C.1
 * (PRODUCT_SPEC_v0_1.md:4849-4876), verbatim.
 *
 * This file is the SINGLE canonical declaration site for the reliability
 * types (D-60): `AgentTrajectoryPhase`, `AgentTrajectoryState`,
 * `CompletionEvidence`, and `AgentTurnOutcome`. `ToolExecutionResult` remains
 * in `@/core/ai/types` (spec 4844) and references `CompletionEvidence` via the
 * `import('@/types/harness')` seam (spec 4339). No parallel copy in
 * `src/core/ai` — the alias target is authoritative (spec 4833 canonical-home
 * rule).
 *
 * C.1 shapes are TS interfaces (no Zod mandated — Appendix O.2 does not
 * require schemas; these are compile-time contracts inside the AI core). The
 * closed literal unions are the "make illegal states unrepresentable"
 * discipline (D-38 / §21.6: no invented statuses).
 */

/** C.1 — closed 10-value trajectory phase union (§28.2 AGT-01). */
export type AgentTrajectoryPhase =
  | 'assembling-context'
  | 'planning'
  | 'waiting-for-permission'
  | 'executing'
  | 'verifying'
  | 'replanning'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'aborted';

/** C.1 — per-turn trajectory snapshot (D-63; in-memory, AITransactionLog is Phase 11). */
export interface AgentTrajectoryState {
  operationId: string;
  phase: AgentTrajectoryPhase;
  plannerCalls: number;
  toolCalls: number;
  updatedAt: number;
}

/** C.1 — postcondition evidence for a side-effecting tool (AGT-02). */
export interface CompletionEvidence {
  toolName: string;
  operationId: string;
  /** Verifier that produced this evidence (TOL-03). */
  postconditionId: string;
  ok: boolean;
  verifiedAt: number;
  detail?: string;
}

/** C.1 — the turn's honest outcome. Cap exhaustion => 'partial', never 'completed' (AGT-03). */
export interface AgentTurnOutcome {
  operationId: string;
  status: 'completed' | 'partial' | 'failed' | 'aborted';
  reasonCode: string;
  evidence: CompletionEvidence[];
  plannerCalls: number;
  toolCalls: number;
}