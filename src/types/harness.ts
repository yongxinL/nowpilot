// src/types/harness.ts — Source: §C.1 canonical home rule (R-1, Golden Rule 2)
// Phase 1 shipped the MINIMAL subset: CompletionEvidence only, the shape
// referenced by Appendix C ToolExecutionResult (evidence is set for
// side-effecting tools, §28.2).
// Phase 3a (03a-01) REALIZES the extension point the Phase-1 header declared:
// the §28.2 agent-reliability types (AgentTrajectoryPhase, AgentTrajectoryState,
// AgentTurnOutcome) land here VERBATIM from Appendix C.1 (L4810-4837), the
// legal-transition table (C5) is defined here ONCE (R-1), and the Zod boundary
// schemas (GR-4, D-3a-20) are co-located with the types they validate —
// mirroring the ProviderConfigSchema precedent in src/core/ai/types.ts.
// CompletionEvidence is UNCHANGED from Phase 1.
//
// Later harness-track groups (ContextItem, WorkingMemory, ToolCapabilityManifest,
// StageEvent, collaboration types, ...) extend THIS file in their target
// phases — never relocate. Consumers (src/core/ai/types.ts
// ToolExecutionResult.evidence, OutcomeVerifier 03a-02, AgentOrchestrator
// 03a-03) import from here, never re-declare (R-1, C.1 type-home table L4798).
import { z } from 'zod';

// ---- Agent reliability (Phase 3a, §28.2; C.1 L4809-4837 VERBATIM) ----

/** C.1: the 10-state trajectory machine of a single agent run (AGT-01). */
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

export interface AgentTrajectoryState {
  operationId: string;
  phase: AgentTrajectoryPhase;
  plannerCalls: number;
  toolCalls: number;
  updatedAt: number;
}

/** C.1: unchanged since Phase 1 (evidence for side-effecting tools, §28.2). */
export interface CompletionEvidence {
  toolName: string;
  operationId: string;
  postconditionId: string; // verifier that produced this evidence (TOL-03)
  ok: boolean;
  verifiedAt: number;
  detail?: string;
}

/**
 * C.1 (L4830-4837): the structured turn outcome. `status` is the 4-value C.1
 * union — cap exhaustion maps to 'partial' (reasonCode 'cap_exhausted'),
 * NEVER 'completed' (AGT-03, D-3a-07). verification_failed surfaces as
 * status 'failed' + reasonCode 'verification_failed' (C.1 union has no
 * 'verification_failed' member — Open Q1 resolution); 'waiting-for-permission'
 * is a trajectory PHASE (the turn pauses), never a terminal outcome status.
 */
export interface AgentTurnOutcome {
  operationId: string;
  status: 'completed' | 'partial' | 'failed' | 'aborted';
  reasonCode: string; // cap exhaustion => 'partial', never 'completed'
  evidence: CompletionEvidence[];
  plannerCalls: number;
  toolCalls: number;
}

// ---- Zod boundary schemas (GR-4, D-3a-20 — zod 3 API only, research A5) ----

/** Zod boundary validator for AgentTrajectoryPhase (zod 3 z.enum). */
export const AgentTrajectoryPhaseSchema = z.enum([
  'assembling-context',
  'planning',
  'waiting-for-permission',
  'executing',
  'verifying',
  'replanning',
  'rendering',
  'completed',
  'failed',
  'aborted',
]);

export const AgentTrajectoryStateSchema = z.object({
  operationId: z.string(),
  phase: AgentTrajectoryPhaseSchema,
  plannerCalls: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  updatedAt: z.number(),
});

/** Zod boundary validator for CompletionEvidence (unchanged Phase-1 shape). */
export const CompletionEvidenceSchema = z.object({
  toolName: z.string(),
  operationId: z.string(),
  postconditionId: z.string(),
  ok: z.boolean(),
  verifiedAt: z.number(),
  detail: z.string().optional(),
});

/**
 * Zod boundary validator for AgentTurnOutcome. `status` keeps the 4-value C.1
 * union — a 'verification_failed' status value FAILS this enum (AGT-03
 * precision, 03a-01 flagged assumption; the orchestrator 03a-03 owns the
 * verification_failed → 'failed' mapping).
 */
export const AgentTurnOutcomeSchema = z.object({
  operationId: z.string(),
  status: z.enum(['completed', 'partial', 'failed', 'aborted']),
  reasonCode: z.string(),
  evidence: z.array(CompletionEvidenceSchema),
  plannerCalls: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
});

// ---- Legal-transition table (C5, R-1 — the SINGLE definition of reachable
// ---- trajectory transitions; the orchestrator 03a-03 is the only runtime
// ---- caller of transitionPhase, tests 03a-01 exercise the table directly)

/**
 * C5: the 10-state transition table, defined ONCE here (R-1). Terminal states
 * ('completed' | 'failed' | 'aborted') have empty arrays — no outgoing edges.
 * NOTE (03a-01 deviation, Rule 1/3): 'partial' is an OUTCOME STATUS on
 * AgentTurnOutcome, not a member of the C.1 AgentTrajectoryPhase enum, so it
 * cannot be a transition target — a turn reaching 'rendering' produces the
 * 'partial' status in AgentTurnOutcome without entering a trajectory phase.
 */
export const LEGAL_TRANSITIONS: Record<
  AgentTrajectoryPhase,
  readonly AgentTrajectoryPhase[]
> = {
  'assembling-context': ['planning'],
  planning: ['executing', 'rendering', 'waiting-for-permission'],
  'waiting-for-permission': ['planning', 'aborted'],
  executing: ['verifying', 'replanning'],
  verifying: ['planning', 'rendering'],
  replanning: ['executing', 'rendering'],
  rendering: ['completed', 'failed', 'aborted'],
  completed: [],
  failed: [],
  aborted: [],
};

/**
 * C5 (AGT-01): a no-op on legal transitions; throws an Error whose message
 * contains the canonical AGENT_STATE_INVALID code (GR-9) on an illegal one —
 * never a free-form error string.
 */
export function transitionPhase(from: AgentTrajectoryPhase, to: AgentTrajectoryPhase): void {
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new Error(`AGENT_STATE_INVALID: ${from} -> ${to}`);
  }
}
