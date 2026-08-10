// src/core/ai/AgentOrchestrator.ts — Source: PRODUCT_SPEC Appendix I VERBATIM
// (lines 5537-5619). D-20 (03-CONTEXT): runAgentTurn returns the simple
// AgentTurnOutput { operationId, streamedText, toolResults, reasonCode } — the
// output struct stays verbatim; the reliability machinery that later rewires
// this loop belongs to Phase 3a and is NOT built here (never jump ahead).
// AgentTurnInput.tier is VERBATIM the Appendix-I caps shape
// { plannerCap, toolCap, mcpChaining } (spec lines 5551-5555) — NOT
// ModelContextTier; the hook (03-08) populates that verbatim field via
// capsForTier(context.tier) (tiny 1/1, small 2/1, medium 3/2, large 5/3, §1.4).
//
// Documented Phase-3 input-only deviations (D-20): the optional onStreamDelta?
// carries live renderer deltas to the hook's ChunkBuffer (AI-03); the optional
// invocation? (StageResolver) supplies the per-stage StageInvocation bundles
// from 03-05 createStageInvocation — PlannerService ctx + RendererService model
// + the F-5 call shape. The OUTPUT struct is unchanged (D-20 intact).
//
// §1.4 tier caps are enforced ONLY here (Appendix I rule): cap exhaustion
// terminates with planner_cap_reached / tool_cap_reached. Every path terminates
// in a bounded terminal reasonCode: planner failure → deterministic
// 'planner_failed' fallback (§1.2 — no re-invocation); provider-unconfigured
// invocation resolution → 'provider_unconfigured' (no model call); abort →
// AbortError; success → the planner's reasonCode or 'ask_clarification'.
// Provider-level failures (the typed ProviderUnavailableError from 03-05)
// propagate as the visible provider-failure state for the hook's failed UI.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { isProviderUnconfiguredError } from '@/core/ai/ProviderRouter';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { ExecutorService } from '@/core/ai/ExecutorService';
import { PlannerService } from '@/core/ai/PlannerService';
import type { PlannerDecision } from '@/core/ai/PlannerService';
import { RendererService } from '@/core/ai/RendererService';
import type { ModelContextTier } from '@/core/context/ModelContextTier';
import type { OptimizedContext, ToolExecutionResult } from '@/core/ai/types';

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
}

export interface AgentTurnOutput {
  operationId: string;
  streamedText: string;
  toolResults: ToolExecutionResult<unknown>[];
  reasonCode: string;
}

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
  const toolResults: ToolExecutionResult<unknown>[] = [];
  try {
    return await runTurn(input, toolResults);
  } catch (e) {
    if (isProviderUnconfiguredError(e)) {
      // D-07 gate: no configured+enabled provider matches the tier — terminate
      // with the provider_unconfigured reasonCode and NO model call.
      return {
        operationId: input.operationId,
        streamedText: '',
        toolResults,
        reasonCode: 'provider_unconfigured',
      };
    }
    throw e;
  }
}

/** The Appendix-I bounded loop (verbatim shape). */
async function runTurn(
  input: AgentTurnInput,
  toolResults: ToolExecutionResult<unknown>[],
): Promise<AgentTurnOutput> {
  let plannerCalls = 0;
  let toolCalls = 0;
  while (true) {
    if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
    if (plannerCalls >= input.tier.plannerCap) return await finish('planner_cap_reached');
    plannerCalls++;
    const decision = await planOnce(input);
    if (decision.action === 'answer' || decision.action === 'ask_clarification') {
      return await finish(
        decision.action === 'answer'
          ? (decision as { reasonCode: string }).reasonCode
          : 'ask_clarification',
      );
    }
    if (toolCalls >= input.tier.toolCap) return await finish('tool_cap_reached');
    toolCalls++;
    const result = await ExecutorService.execute({
      operationId: input.operationId,
      toolName: (decision as { toolName: string }).toolName,
      input: (decision as { input: unknown }).input,
      abortSignal: input.abortSignal,
    });
    toolResults.push(result);
  }

  async function finish(reasonCode: string): Promise<AgentTurnOutput> {
    const rendererInvocation = resolveStage(input, 'renderer');
    const rendered = await RendererService.render({
      operationId: input.operationId,
      context: input.context,
      userInput: input.userInput,
      toolResults,
      abortSignal: input.abortSignal,
      invocation: rendererInvocation,
      onDelta: input.onStreamDelta,
    });
    return {
      operationId: input.operationId,
      streamedText: rendered.text,
      toolResults,
      reasonCode,
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
async function planOnce(input: AgentTurnInput): Promise<PlannerDecision> {
  const invocation = resolveStage(input, 'planner');
  try {
    return await PlannerService.plan({
      operationId: input.operationId,
      context: input.context,
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

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}
