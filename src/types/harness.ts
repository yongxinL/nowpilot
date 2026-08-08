// src/types/harness.ts — Source: §C.1 canonical home rule (R-1, Golden Rule 2)
// Phase 1 ships the MINIMAL subset: CompletionEvidence only, the shape referenced
// by Appendix C ToolExecutionResult (evidence is set for side-effecting tools, §28.2).
// NOTE: this file will extend with the full §28.2 harness-track types (AgentTrajectoryState,
// AgentTurnOutcome, ContextItem, WorkingMemory, ...) in Phase 3a — do not relocate.
export interface CompletionEvidence {
  toolName: string;
  operationId: string;
  postconditionId: string; // verifier that produced this evidence (TOL-03)
  ok: boolean;
  verifiedAt: number;
  detail?: string;
}
