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
// Phase 4b (04b-01) REALIZES the ContextItem extension point the header
// declared: the C.1 trust-aware types (TrustLevel, ContextItem,
// ContextReceiptEntry — spec Appendix C.1 L4877-4899 VERBATIM, §28.3) land
// here with co-located Zod boundary schemas (GR-4, D-3a-20 precedent).
// ContextItem.kind mirrors PromptSection['kind'] via type import (R-1 — the
// union is NEVER re-declared; 03a-01 lockstep incl. 'tool_result').
import { z } from 'zod';
import type { PromptSection } from '@/core/ai/types';

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
export const LEGAL_TRANSITIONS: Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> = {
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

// ---- Trust-aware context (Phase 4b, §28.3; C.1 L4877-4899 VERBATIM,
// ---- CTX-01/D-4b-01 — the trust envelope every downstream 4b module imports)

/**
 * C.1 (L4878): the 5-member trust provenance union. `system`/`user` may carry
 * instruction authority; `tool`/`retrieved`/`untrusted` MUST NOT (CTX-01,
 * enforced at the Zod boundary by ContextItemSchema and at runtime by
 * applyTrustPolicy, O.3).
 */
export type TrustLevel = 'system' | 'user' | 'tool' | 'retrieved' | 'untrusted';

/**
 * C.1 (L4879-4889): a single source item entering the optimized context.
 * `kind` mirrors PromptSection['kind'] (R-1 type import — never re-declared).
 * `instructionAuthority` MUST be false for retrieved/untrusted data (CTX-01).
 * `disclosureReady?: boolean` is the CTX-05 progressive-skill-disclosure seam
 * (D-4b-13) — type-level only in 4b; skills land Phase 8.
 */
export interface ContextItem {
  id: string;
  kind: PromptSection['kind'];
  text: string;
  tokens: number;
  trust: TrustLevel;
  instructionAuthority: boolean; // MUST be false for retrieved/untrusted data
  relevance: number; // 0..1
  freshness: number; // 0..1
  sensitivity: 'none' | 'low' | 'high';
  sourceId: string;
  /** CTX-05 seam (D-4b-13): progressive-skill-disclosure readiness — type-level only in 4b. */
  disclosureReady?: boolean;
}

/**
 * C.1 (L4891-4898): one row of the context receipt (CTX-03) — reconstructs
 * every packing decision (included/excluded, token deltas, compression,
 * omit reason) WITHOUT re-running the optimizer (D-4b-11). Never carries raw
 * text (R-10) — sourceId + token counts only.
 */
export interface ContextReceiptEntry {
  sourceId: string;
  included: boolean;
  originalTokens: number;
  finalTokens: number;
  compression?: 'summarise' | 'structural' | 'topk';
  cacheEligible: boolean;
  omitReason?: string;
}

// ---- Zod boundary schemas (GR-4, D-3a-20 — zod 3 API only) ----

/** Zod boundary validator for TrustLevel (C.1 L4878 — 5 members verbatim). */
export const TrustLevelSchema = z.enum(['system', 'user', 'tool', 'retrieved', 'untrusted']);

/**
 * Zod boundary validator for ContextItem (C.1 L4879-4889). `kind` uses the
 * 8-member PromptSection union verbatim (incl. 'tool_result', 03a-01 lockstep)
 * so a new PromptSection kind landing without a schema update fails at the
 * boundary (D-04-18 union-parity test pattern). CTX-01 MUST-be-false invariant:
 * instructionAuthority:true combined with trust 'tool'/'retrieved'/'untrusted'
 * is REJECTED — a forged authority claim cannot survive the boundary.
 */
export const ContextItemSchema = z
  .object({
    id: z.string(),
    kind: z.enum([
      'system',
      'tool_schemas',
      'preferences',
      'memory',
      'context',
      'task',
      'user_input',
      'tool_result',
    ]),
    text: z.string(),
    tokens: z.number().int().nonnegative(),
    trust: TrustLevelSchema,
    instructionAuthority: z.boolean(),
    relevance: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1),
    sensitivity: z.enum(['none', 'low', 'high']),
    sourceId: z.string(),
    // CTX-05 seam (D-4b-13): optional boolean — type-level field presence.
    disclosureReady: z.boolean().optional(),
  })
  .refine((c) => !(c.instructionAuthority && c.trust !== 'system' && c.trust !== 'user'), {
    message: 'CTX-01: instructionAuthority must be false for tool/retrieved/untrusted trust',
    path: ['instructionAuthority'],
  });

/** Zod boundary validator for ContextReceiptEntry (C.1 L4891-4898). */
export const ContextReceiptEntrySchema = z.object({
  sourceId: z.string(),
  included: z.boolean(),
  originalTokens: z.number().int().nonnegative(),
  finalTokens: z.number().int().nonnegative(),
  compression: z.enum(['summarise', 'structural', 'topk']).optional(),
  cacheEligible: z.boolean(),
  omitReason: z.string().optional(),
});

/**
 * Structured omit reasons for the context receipt (Open Q3 resolution,
 * D-4b-12): 'prompt_injection' (quarantined by the injection screener) and
 * 'trust_disabled' (source type switched off in np_trust prefs). Forward-
 * compatible with Phase-5 memory reasons — no new C.2 codes.
 */
export const TrustOmitReasonSchema = z.enum(['prompt_injection', 'trust_disabled']);
export type TrustOmitReason = z.infer<typeof TrustOmitReasonSchema>;
