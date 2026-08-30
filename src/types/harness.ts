import type { PromptSection } from '../core/ai/types';

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

// ---------------------------------------------------------------------------
// Canonical Phase-7 trust-type home — Appendix C.1 (PRODUCT_SPEC_v0_1.md:
// 4878-4900), verbatim. Spec 4838 'Trust context' row mandates this file; O.3
// (spec 6369) imports from @/types/harness. The only import this file needs is
// the type-only PromptSection (ContextItem.kind references PromptSection['kind'])
// — ai/types.ts:138 `import('@/types/harness')` seam shows the cross-file
// direction works both ways.
// ---------------------------------------------------------------------------

/** C.1 — closed 5-value trust-level union (spec 4879). */
export type TrustLevel = 'system' | 'user' | 'tool' | 'retrieved' | 'untrusted';

/** C.1 — item-level trust metadata (spec 4880-4891, verbatim; CTX-01). */
export interface ContextItem {
  id: string;
  kind: PromptSection['kind'];
  text: string;
  tokens: number;
  trust: TrustLevel;
  /** MUST be false for retrieved/untrusted data (D-94/CTX-02). */
  instructionAuthority: boolean;
  /** 0..1 */
  relevance: number;
  /** 0..1 */
  freshness: number;
  sensitivity: 'none' | 'low' | 'high';
  sourceId: string;
}

/** C.1 — per-source context receipt entry (spec 4892-4900, verbatim; CTX-03). */
export interface ContextReceiptEntry {
  sourceId: string;
  included: boolean;
  originalTokens: number;
  finalTokens: number;
  compression?: 'summarise' | 'structural' | 'topk';
  cacheEligible: boolean;
  omitReason?: string;
}