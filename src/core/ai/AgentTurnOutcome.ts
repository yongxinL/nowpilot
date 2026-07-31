import { z } from 'zod';
import type {
  AgentTrajectoryState,
  CompletionEvidence,
  CompletionEvidenceCheck,
  CompletionResultRef,
  ToolExecutionResult,
  TrajectoryStateEntry,
} from './types';
import { AGENT_TRAJECTORY_STATES, TIER_CAPS } from './types';

/**
 * Terminal state of one agent turn (AGT-03). Cap exhaustion is `partial`,
 * not `completed`; abort never renders success.
 */
export type AgentTerminalState = 'completed' | 'partial' | 'failed' | 'aborted';

export const AGENT_TERMINAL_STATES = ['completed', 'partial', 'failed', 'aborted'] as const;

/**
 * Closed, outcome-oriented reason-code union (D-05). Detailed technical
 * errors remain in `diagnostics.errors`; PipelineError technical codes are
 * never used as reason codes (D-12).
 */
export type AgentTurnReasonCode =
  | 'planner_answer'
  | 'planner_clarification'
  | 'planner_cap_reached'
  | 'tool_cap_reached'
  | 'tool_completed'
  | 'tool_failed'
  | 'permission_denied'
  | 'completion_verified'
  | 'completion_unverified'
  | 'verification_failed'
  | 'planner_failed'
  | 'renderer_failed'
  | 'pipeline_failed'
  | 'invalid_state_transition'
  | 'irreversible_action_executed'
  | 'user_aborted'
  | 'caller_aborted';

export const AGENT_TURN_REASON_CODES: readonly AgentTurnReasonCode[] = [
  'planner_answer',
  'planner_clarification',
  'planner_cap_reached',
  'tool_cap_reached',
  'tool_completed',
  'tool_failed',
  'permission_denied',
  'completion_verified',
  'completion_unverified',
  'verification_failed',
  'planner_failed',
  'renderer_failed',
  'pipeline_failed',
  'invalid_state_transition',
  'irreversible_action_executed',
  'user_aborted',
  'caller_aborted',
];

/**
 * Bounded outcome warning string (Rev. C §28.2): the renderer observed
 * evidence contradicting a claimed write. It is a diagnostics warning, not
 * a PipelineError classification.
 */
export const OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION = 'RENDERER_EVIDENCE_CONTRADICTION';

/**
 * The immutable comprehensive result of one agent turn (D-02). All array
 * fields are readonly; `abort` carries user/caller origin when known.
 */
export interface AgentTurnOutcome {
  operationId: string;
  terminalState: AgentTerminalState;
  reasonCode: AgentTurnReasonCode;
  renderedAnswer: string | null;
  trajectory: readonly TrajectoryStateEntry[];
  evidence: readonly CompletionEvidence[];
  toolResults: readonly ToolExecutionResult[];
  limits: {
    plannerCalls: number;
    plannerCap: number;
    plannerCapReached: boolean;
    toolCalls: number;
    toolCap: number;
    toolCapReached: boolean;
  };
  abort?: {
    requested: boolean;
    requestedAt?: number;
    stage?: AgentTrajectoryState;
    origin?: 'user' | 'caller';
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    currency: string;
  };
  diagnostics: {
    errors: readonly string[];
    warnings: readonly string[];
  };
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas (zod v4)
// ─────────────────────────────────────────────────────────────────────────────

const TrajectoryStateEntrySchema = z.object({
  state: z.enum(AGENT_TRAJECTORY_STATES),
  enteredAt: z.number().nonnegative(),
  exitedAt: z.number().nonnegative().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  reasonCode: z.string().optional(),
  plannerCall: z.number().int().nonnegative().optional(),
  toolCall: z.number().int().nonnegative().optional(),
  toolName: z.string().optional(),
});

/**
 * Strict schema for evidence checks — unrestricted fields (raw output,
 * secrets) are rejected outright (T-03a-04).
 */
const CompletionEvidenceCheckSchema = z
  .object({
    checkId: z.string().min(1),
    name: z.string().min(1),
    passed: z.boolean(),
    expected: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    actualRef: z.string().optional(),
    message: z.string().max(280).optional(),
  })
  .strict();

const CompletionResultRefSchema = z.object({
  type: z.string().min(1),
  ref: z.string().min(1),
});

const CompletionEvidenceShared = {
  id: z.string().min(1),
  operationId: z.string().min(1),
  toolCallId: z.string().min(1),
  toolName: z.string().min(1),
  verifiedAt: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
};

export const VerifiedCompletionEvidenceSchema = z
  .object({
    ...CompletionEvidenceShared,
    verified: z.literal(true),
    verifierType: z.enum(['schema', 'environment', 'read-after-write', 'tool-provided']),
    checks: z.array(CompletionEvidenceCheckSchema),
    resultRef: CompletionResultRefSchema.optional(),
  })
  .strict();

export const UnverifiedCompletionEvidenceSchema = z
  .object({
    ...CompletionEvidenceShared,
    verified: z.literal(false),
    failureReason: z.enum([
      'postcondition_failed',
      'evidence_unavailable',
      'verification_timeout',
      'verification_error',
      'aborted',
    ]),
    retryable: z.boolean(),
  })
  .strict();

export const CompletionEvidenceSchema = z.discriminatedUnion('verified', [
  VerifiedCompletionEvidenceSchema,
  UnverifiedCompletionEvidenceSchema,
]);

const ToolExecutionResultSchema = z.object({
  toolName: z.string().min(1),
  output: z.unknown(),
  durationMs: z.number().nonnegative(),
  toolCallId: z.string().min(1),
  evidence: CompletionEvidenceSchema.optional(),
});

/**
 * Comprehensive outcome schema (D-02). Enforces the closed reason-code
 * union, the terminal-state union, evidence discriminators, and the
 * aborted-answer invariant: an aborted outcome must not carry a rendered
 * answer (AGT-03).
 */
export const AgentTurnOutcomeSchema: z.ZodType<AgentTurnOutcome> = z
  .object({
    operationId: z.string().min(1),
    terminalState: z.enum(AGENT_TERMINAL_STATES),
    reasonCode: z.enum(AGENT_TURN_REASON_CODES),
    renderedAnswer: z.string().nullable(),
    trajectory: z.array(TrajectoryStateEntrySchema),
    evidence: z.array(CompletionEvidenceSchema),
    toolResults: z.array(ToolExecutionResultSchema),
    limits: z.object({
      plannerCalls: z.number().int().nonnegative(),
      plannerCap: z.number().int().nonnegative(),
      plannerCapReached: z.boolean(),
      toolCalls: z.number().int().nonnegative(),
      toolCap: z.number().int().nonnegative(),
      toolCapReached: z.boolean(),
    }),
    abort: z
      .object({
        requested: z.boolean(),
        requestedAt: z.number().nonnegative().optional(),
        stage: z.enum(AGENT_TRAJECTORY_STATES).optional(),
        origin: z.enum(['user', 'caller']).optional(),
      })
      .optional(),
    usage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative(),
      estimatedCost: z.number().nonnegative(),
      currency: z.string().min(1),
    }),
    diagnostics: z.object({
      errors: z.array(z.string()),
      warnings: z.array(z.string()),
    }),
    startedAt: z.number().nonnegative(),
    endedAt: z.number().nonnegative(),
    durationMs: z.number().nonnegative(),
  })
  .refine((outcome) => outcome.terminalState !== 'aborted' || outcome.renderedAnswer === null, {
    message: 'Aborted outcomes must not carry a rendered answer.',
    path: ['renderedAnswer'],
  });

export interface CreateAgentTurnOutcomeInput {
  operationId: string;
  terminalState: AgentTerminalState;
  reasonCode: AgentTurnReasonCode;
  renderedAnswer?: string | null;
  trajectory?: readonly TrajectoryStateEntry[];
  evidence?: readonly CompletionEvidence[];
  toolResults?: readonly ToolExecutionResult[];
  limits?: {
    plannerCalls?: number;
    plannerCap?: number;
    plannerCapReached?: boolean;
    toolCalls?: number;
    toolCap?: number;
    toolCapReached?: boolean;
  };
  abort?: AgentTurnOutcome['abort'];
  usage?: Partial<AgentTurnOutcome['usage']>;
  diagnostics?: { errors?: readonly string[]; warnings?: readonly string[] };
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
}

/**
 * Outcome factory: fills runtime defaults, then validates the complete
 * record through AgentTurnOutcomeSchema so every produced outcome is
 * guaranteed schema-valid.
 */
export function createAgentTurnOutcome(input: CreateAgentTurnOutcomeInput): AgentTurnOutcome {
  const now = Date.now();
  const startedAt = input.startedAt ?? now;
  const endedAt = input.endedAt ?? now;
  const durationMs = input.durationMs ?? (startedAt <= endedAt ? endedAt - startedAt : 0);
  const outcome: AgentTurnOutcome = {
    operationId: input.operationId,
    terminalState: input.terminalState,
    reasonCode: input.reasonCode,
    renderedAnswer: input.renderedAnswer ?? null,
    trajectory: input.trajectory ?? [],
    evidence: input.evidence ?? [],
    toolResults: input.toolResults ?? [],
    limits: {
      plannerCalls: input.limits?.plannerCalls ?? 0,
      plannerCap: input.limits?.plannerCap ?? TIER_CAPS.FAST.planner,
      plannerCapReached: input.limits?.plannerCapReached ?? false,
      toolCalls: input.limits?.toolCalls ?? 0,
      toolCap: input.limits?.toolCap ?? TIER_CAPS.FAST.tool,
      toolCapReached: input.limits?.toolCapReached ?? false,
    },
    abort: input.abort,
    usage: {
      inputTokens: input.usage?.inputTokens ?? 0,
      outputTokens: input.usage?.outputTokens ?? 0,
      totalTokens: input.usage?.totalTokens ?? 0,
      estimatedCost: input.usage?.estimatedCost ?? 0,
      currency: input.usage?.currency ?? 'USD',
    },
    diagnostics: {
      errors: input.diagnostics?.errors ?? [],
      warnings: input.diagnostics?.warnings ?? [],
    },
    startedAt,
    endedAt,
    durationMs,
  };
  return AgentTurnOutcomeSchema.parse(outcome);
}
