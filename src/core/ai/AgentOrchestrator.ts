// src/core/ai/AgentOrchestrator.ts — Source: PRODUCT_SPEC Appendix I
// (lines 5537-5619) + Phase 3a rewire. D-20 FENCE INVERTED (D-3a-18): this
// module now OWNS the reliability machinery — runAgentTurn returns the C.1
// AgentTurnOutcome (NOT the Phase-3 AgentTurnOutput), embeds trajectory
// transitions (AGT-01), the trajectory cap (D-3a-10), the CheckpointRecorder
// rollback seam (D-3a-09), bounded replan-on-tool-failure with an F-4
// `tool_result` section (D-3a-11/12/13, AGT-04), the pause seam
// (D-3a-15/16, AGT-05), and the buildOutcome terminal (D-3a-05/06/07).
// streamedText left the output struct — it travels via onStreamDelta (D-3a-18).
//
// §1.4 tier caps are enforced ONLY here (Appendix I rule): cap exhaustion
// maps to status 'partial' + reasonCode 'cap_exhausted' via buildOutcome
// (AGT-03, D-3a-07 — NEVER 'completed'); the trajectory cap force-terminates
// 'partial' + 'trajectory_cap_exceeded' (D-3a-10). Every path terminates in a
// bounded terminal: planner failure → deterministic 'planner_failed' fallback
// (§1.2 — no re-invocation, R-2); provider-unconfigured resolution →
// 'provider_unconfigured' (no model call); repeated-identical tool failure →
// 'failed' + 'replan_identical_failure' (D-3a-12); abort → AbortError (O4);
// success → buildOutcome 'completed'. The renderer runs once at finish with
// verdict + evidence (display-only, D-3a-17).
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { isProviderUnconfiguredError } from '@/core/ai/ProviderRouter';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { ExecutorService } from '@/core/ai/ExecutorService';
import { PlannerService } from '@/core/ai/PlannerService';
import type { PlannerDecision } from '@/core/ai/PlannerService';
import { RendererService } from '@/core/ai/RendererService';
import { buildOutcome } from '@/core/ai/OutcomeVerifier';
import type { Verifier } from '@/core/ai/OutcomeVerifier';
import { CheckpointRecorder } from '@/core/ai/CheckpointRecorder';
import type { LoopState } from '@/core/ai/CheckpointRecorder';
import { estimateTokens } from '@/core/ai/contextHelper';
import { transitionPhase } from '@/types/harness';
import type { AgentTrajectoryPhase, AgentTrajectoryState, AgentTurnOutcome } from '@/types/harness';
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import type { OptimizedContext, PromptSection, ToolExecutionResult } from '@/core/ai/types';

/** §1.2 — planner timeout (Appendix L timeoutMs: planner 3s / renderer 5s). */
export const PLANNER_TIMEOUT_MS = 3_000;

/** §1.4 verbatim caps shape (Appendix I lines 5551-5555). */
export interface TurnCaps {
  plannerCap: number;
  toolCap: number;
  mcpChaining: boolean;
}

/** §1.4 caps table (tiny 1/1, small 2/1, medium 3/2, large 5/3). */
const TIER_CAPS: Record<ModelContextTier, TurnCaps> = {
  tiny: { plannerCap: 1, toolCap: 1, mcpChaining: false },
  small: { plannerCap: 2, toolCap: 1, mcpChaining: false },
  medium: { plannerCap: 3, toolCap: 2, mcpChaining: true },
  large: { plannerCap: 5, toolCap: 3, mcpChaining: true },
};

/** Maps a ModelContextTier to the verbatim caps shape the hook passes as AgentTurnInput.tier. */
export function capsForTier(tier: ModelContextTier): TurnCaps {
  return TIER_CAPS[tier];
}

/**
 * D-3a-10 (research A3): the hard trajectory-length ceiling = plannerCap +
 * toolCap + 1 (slack constant 1). Guards pathological loops (a planner that
 * never answers + a tool that keeps failing retryably with fresh identities
 * would otherwise spin past the individual caps via replans). Deterministic
 * and testable.
 */
export function trajectoryCapFor(tier: TurnCaps): number {
  return tier.plannerCap + tier.toolCap + 1;
}

/**
 * The per-stage invocation resolver seam: given a stage, returns the
 * StageInvocation bundle 03-05's createStageInvocation produces (providerId,
 * model, jsonMode, callProviderJsonMode). The hook (03-08) builds this closure
 * over the Router with the turn's operationId/tier/privacyMode/configured
 * providers — the orchestrator stays provider-agnostic (D-18/D-19).
 */
export type StageResolver = (stage: 'planner' | 'renderer') => StageInvocation;

export interface AgentTurnInput {
  operationId: string;
  userInput: string;
  context: OptimizedContext;
  abortSignal: AbortSignal;
  /** VERBATIM Appendix-I caps shape (never ModelContextTier). */
  tier: TurnCaps;
  /** Documented Phase-3 input-only deviation: live renderer deltas → the hook's ChunkBuffer. */
  onStreamDelta?: (delta: string) => void;
  /** Documented Phase-3 input-only deviation: per-stage StageInvocation bundles (03-05). */
  invocation?: StageResolver;
  /**
   * D-3a-16 (Phase 3a): input-only trajectory recorder — mirrors onStreamDelta.
   * Direct calls, never an event bus (L1). Records each reached trajectory
   * phase (assembling-context → … → terminal) with the loop counters.
   */
  onTransition?: (state: AgentTrajectoryState) => void;
  /**
   * D-3a-15/16 (Phase 3a, AGT-05 core seam): input-only pause seam. When the
   * planner emits ask_clarification (or a stage emits an input-required event)
   * the turn surfaces 'waiting-for-permission' and pauses WITHOUT terminating;
   * abort cancels the wait (abort wins, O4). No UI / no gated tools in 3a —
   * Phase 8 ships PermissionDialog + ToolCapabilityManifest (TOL-02/03).
   */
  onInputRequired?: (q: {
    roleId: string;
    question: string;
    options?: string[];
    reason: 'clarification' | 'permission';
  }) => void;
  /**
   * D-3a-05 (Phase 3a): postcondition verifiers keyed by toolName fed to
   * buildOutcome. Empty in production (3a ships zero dangerous tools); tests
   * inject the mock dangerous tool's verifier (tests/fixtures/trajectory.ts).
   */
  verifiers?: Record<string, Verifier>;
}

/**
 * C.1 (L4830-4837): the structured turn outcome. The orchestrator is the SOLE
 * terminal decision authority (D-3a-05) — buildOutcome returns verdicts only,
 * the renderer never re-verifies (display-only, D-3a-17).
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutcome> {
  const toolResults: ToolExecutionResult<unknown>[] = [];
  try {
    return await runTurn(input, toolResults);
  } catch (e) {
    if (isProviderUnconfiguredError(e)) {
      // D-07 gate: no configured+enabled provider matches the tier — terminate
      // with the provider_unconfigured terminal and NO model call. Kept as a
      // failed terminal (D-3a-19 / unchanged UX, 03a-04 hook mapping).
      return {
        operationId: input.operationId,
        status: 'failed',
        reasonCode: 'provider_unconfigured',
        evidence: [],
        plannerCalls: 0,
        toolCalls: 0,
      };
    }
    throw e;
  }
}

/**
 * The Phase-3a bounded loop. Every iteration: trajectory-cap check → plannerCap
 * check → planOnce → decision dispatch (answer / ask_clarification / run_tool).
 * Tool failures either replan ONCE per failed tool (retryable, D-3a-11/12/13)
 * or fall through to the buildOutcome terminal (fail-closed, D-3a-06).
 */
async function runTurn(
  input: AgentTurnInput,
  toolResults: ToolExecutionResult<unknown>[],
): Promise<AgentTurnOutcome> {
  let plannerCalls = 0;
  let toolCalls = 0;
  let phase: AgentTrajectoryPhase = 'assembling-context';
  const checkpoint = new CheckpointRecorder();
  const replannedTools = new Set<string>();
  const replanSections: PromptSection[] = [];
  const verifiers = input.verifiers ?? {};

  // D-3a-16: record the initial trajectory state, then transition to planning.
  input.onTransition?.({
    operationId: input.operationId,
    phase: 'assembling-context',
    plannerCalls: 0,
    toolCalls: 0,
    updatedAt: Date.now(),
  });
  const emit = (next: AgentTrajectoryPhase): void => {
    // C5: an illegal transition throws AGENT_STATE_INVALID (GR-9).
    transitionPhase(phase, next);
    phase = next;
    input.onTransition?.({
      operationId: input.operationId,
      phase: next,
      plannerCalls,
      toolCalls,
      updatedAt: Date.now(),
    });
  };
  emit('planning'); // assembling-context → planning

  while (true) {
    if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');

    // D-3a-10 trajectory cap: force-terminate BEFORE the individual caps so a
    // pathological replan loop (plannerCalls pushed past plannerCap by replans)
    // is caught by the sum ceiling, not silently capped as cap_exhausted.
    if (plannerCalls + toolCalls >= trajectoryCapFor(input.tier)) {
      return await finish({ reasonCode: 'trajectory_cap_exceeded', capHit: true });
    }
    if (plannerCalls >= input.tier.plannerCap) {
      // planner_cap_reached → buildOutcome 'partial' + 'cap_exhausted' (AGT-03).
      return await finish({ capHit: true });
    }
    plannerCalls++;
    const decision = await planOnce(input, replanSections);

    if (decision.action === 'answer') {
      // planner_failed fallback is a FAILED terminal (never a silent success).
      if (decision.reasonCode === 'planner_failed') {
        return await finish({ status: 'failed', reasonCode: 'planner_failed' });
      }
      return await finish({});
    }
    if (decision.action === 'ask_clarification') {
      // D-3a-15/16 pause seam: waiting-for-permission, turn stays open.
      emit('waiting-for-permission'); // planning → waiting-for-permission
      input.onInputRequired?.({
        roleId: 'user',
        question: decision.question,
        options: decision.options,
        reason: 'clarification',
      });
      await waitForAbortOrResume(input);
      emit('planning'); // waiting-for-permission → planning (resumed)
      continue;
    }

    // run_tool
    if (toolCalls >= input.tier.toolCap) {
      // tool_cap_reached → buildOutcome 'partial' + 'cap_exhausted' (AGT-03).
      return await finish({ capHit: true });
    }
    emit('executing'); // planning → executing
    toolCalls++;
    checkpoint.capture(input.operationId, {
      toolResults: [...toolResults],
      plannerCalls,
      toolCalls,
      phase: 'executing',
    });
    const result = await ExecutorService.execute({
      operationId: input.operationId,
      toolName: (decision as { toolName: string }).toolName,
      input: (decision as { input: unknown }).input,
      abortSignal: input.abortSignal,
    });
    emit('verifying'); // executing → verifying

    if (result.ok) {
      toolResults.push(result);
      emit('planning'); // verifying → planning (loop continues)
      continue;
    }

    // Tool failure.
    const toolName = result.toolName;
    const retryable = result.error?.retryable === true;
    if (retryable && !replannedTools.has(toolName)) {
      // D-3a-09 checkpoint rollback: discard the failed result, rewind counters.
      const restored = checkpoint.restore(input.operationId);
      if (restored) {
        toolResults = restored.toolResults;
        plannerCalls = restored.plannerCalls;
        toolCalls = restored.toolCalls;
        phase = (restored as LoopState).phase as AgentTrajectoryPhase;
      }
      // D-3a-13: each replan consumes one plannerCalls++ slot — the loop-top
      // increment (before planOnce) already charges the replan's planOnce, so
      // the restore's rewind + that single increment is the entire cost. The
      // replan-branch itself must NOT increment again (that would double-charge
      // the same planOnce and push plannerCalls past plannerCap, making replan
      // turns terminate partial/cap_exhausted on the default medium tier). At
      // most one replan per failed tool (D-3a-12); the trajectory cap bounds
      // the cascade.
      replannedTools.add(toolName);
      // D-3a-11 (F-4, Pitfall 7): failure feedback as a sections-in
      // tool_result PromptSection — NEVER a joined-string rebuild.
      const feedbackText = `${toolName} failed: ${result.error?.code ?? 'unknown'}`;
      replanSections.push({
        kind: 'tool_result',
        text: feedbackText,
        tokens: estimateTokens(feedbackText),
        stable: false,
        sourceId: 'replan-feedback',
      });
      emit('replanning'); // verifying → replanning
      continue; // loop top re-invokes planOnce with the replan feedback
    }

    // D-3a-12 repeated-identical terminal (or non-retryable fail-closed).
    toolResults.push(result);
    if (replannedTools.has(toolName)) {
      return await finish({ status: 'failed', reasonCode: 'replan_identical_failure' });
    }
    // Non-retryable tool failure → fail-closed: verification_failed (D-3a-06),
    // never a silent success (R-8).
    return await finish({ status: 'failed', reasonCode: 'verification_failed' });
  }

  /**
   * Terminal authority (D-3a-05): buildOutcome computes the base outcome from
   * the turn's evidence + caps; the orchestrator applies the policy overrides
   * (trajectory-cap / replan-identical / planner-failed / fail-closed tool
   * failure). buildOutcome stays authoritative for the evidence gate — a
   * side-effecting tool without ok:true evidence is never 'completed'. Renders
   * once at finish with the verdict + evidence (display-only renderer, D-3a-17).
   */
  async function finish(
    overrides: {
      status?: AgentTurnOutcome['status'];
      reasonCode?: string;
      capHit?: boolean;
    } = {},
  ): Promise<AgentTurnOutcome> {
    emit('rendering'); // planning/verifying/replanning → rendering (legal edges)
    const built = await buildOutcome(
      input.operationId,
      toolResults,
      verifiers,
      { plannerCalls, toolCalls, capHit: overrides.capHit ?? false },
      Date.now,
    );
    let terminalStatus: AgentTurnOutcome['status'] = built.status;
    let terminalReasonCode = built.reasonCode;
    if (overrides.status === 'failed') {
      terminalStatus = 'failed';
      terminalReasonCode = overrides.reasonCode ?? terminalReasonCode;
    } else if (overrides.reasonCode === 'trajectory_cap_exceeded') {
      terminalStatus = 'partial';
      terminalReasonCode = 'trajectory_cap_exceeded';
    }
    if (terminalStatus === 'failed' && terminalReasonCode === 'postcondition_failed') {
      // Open Q1: O.2's reasonCode → the verification_failed vocabulary.
      terminalReasonCode = 'verification_failed';
    }
    if (terminalStatus === 'completed' && toolResults.some((r) => !r.ok)) {
      // Fail-closed (R-8): a turn that ran a failed tool is never 'completed'.
      terminalStatus = 'failed';
      terminalReasonCode = 'verification_failed';
    }
    const rendererInvocation = resolveStage(input, 'renderer');
    await RendererService.render({
      operationId: input.operationId,
      context: input.context,
      userInput: input.userInput,
      toolResults,
      abortSignal: input.abortSignal,
      invocation: rendererInvocation,
      onDelta: input.onStreamDelta,
      verdict: terminalStatus,
      evidence: built.evidence,
    });
    // Terminal trajectory phase — partial is an outcome status, not a phase
    // (03a-01 note): completed/failed reach a terminal trajectory phase;
    // partial stops at rendering.
    if (terminalStatus === 'completed')
      emit('completed'); // rendering → completed
    else if (terminalStatus === 'failed') emit('failed'); // rendering → failed
    return {
      operationId: input.operationId,
      status: terminalStatus,
      reasonCode: terminalReasonCode,
      evidence: built.evidence,
      plannerCalls,
      toolCalls,
    };
  }
}

function resolveStage(input: AgentTurnInput, stage: 'planner' | 'renderer'): StageInvocation {
  if (!input.invocation) {
    // Programming error: the hook (03-08) always supplies the resolver.
    throw new Error(`runAgentTurn: no invocation resolver for the ${stage} stage`);
  }
  return input.invocation(stage);
}

/**
 * One planner stage call. The resolver failure for provider_unconfigured
 * propagates to runAgentTurn's terminal catch (no model call); an abort
 * propagates unchanged (AbortError); a provider-level failure (the typed
 * ProviderUnavailableError) propagates as the visible provider-failure state.
 * Every OTHER plan() rejection (the planner's decision machinery failed —
 * structured output, timeout, generic) becomes the deterministic §1.2
 * 'planner_failed' fallback decision — NEVER a re-invocation (R-2), and the
 * renderer still produces the visible fallback answer.
 */
async function planOnce(
  input: AgentTurnInput,
  replanSections: PromptSection[],
): Promise<PlannerDecision> {
  const invocation = resolveStage(input, 'planner');
  try {
    const sections =
      replanSections.length > 0
        ? [...input.context.sections, ...replanSections]
        : input.context.sections;
    return await PlannerService.plan({
      operationId: input.operationId,
      context: { ...input.context, sections },
      userInput: input.userInput,
      abortSignal: input.abortSignal,
      timeoutMs: PLANNER_TIMEOUT_MS,
      providerId: invocation.providerId,
      model: invocation.model.modelId,
      callProviderJsonMode: invocation.callProviderJsonMode,
    });
  } catch (e) {
    if (isAbortError(e)) throw e;
    if (e instanceof Error && (e as { code?: string }).code === 'PROVIDER_UNAVAILABLE') throw e;
    debugLog(
      ERROR_CODES.PLANNER_FAILED,
      'planner failed — deterministic fallback, no re-invocation',
      {
        module: 'AgentOrchestrator',
        error: e instanceof Error ? e : undefined,
        extra: { operationId: input.operationId },
      },
    );
    return { action: 'answer', reasonCode: 'planner_failed' };
  }
}

/**
 * D-3a-15/16 pause-seam wait. The turn stays OPEN (no terminal, no return)
 * until resumed or aborted; abort wins mid-wait (O4) and propagates AbortError.
 * 3a ships the seam only (no resume UI) — the promise rejects on abort and
 * never resolves until Phase 8 wires PermissionDialog resume.
 */
function waitForAbortOrResume(input: AgentTurnInput): Promise<void> {
  return new Promise((resolve, reject) => {
    if (input.abortSignal.aborted) {
      reject(new DOMException('aborted', 'AbortError'));
      return;
    }
    input.abortSignal.addEventListener(
      'abort',
      () => reject(new DOMException('aborted', 'AbortError')),
      { once: true },
    );
    // Phase 8: a resume signal resolves this promise (PermissionDialog).
    void resolve;
  });
}

function isAbortError(err: unknown): boolean {
  // DOMException does not extend Error in every environment — match the
  // canonical AbortError name regardless of prototype chain (ai@4 aborts and
  // the loop-top DOMException both carry name 'AbortError').
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}
