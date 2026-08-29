import { z } from 'zod';
import type { ProviderId, PlannerDecision } from './types';
import { requestJson, type StructuredOutputContext } from './StructuredOutput';
import { debugLog } from '../log/debugLog';

/**
 * PlannerService — §1.2 planner (spec 268-297).
 *
 * Returns exactly one PlannerDecision via StructuredOutput.requestJson:
 * fast tier where available, 3s timeout, one malformed-JSON repair retry
 * (Appendix L), and a closed toolName enum supplied by the caller.
 *
 * §1.2 failure rule (spec 294): "If planner fails twice: fallback to
 * { action: 'answer', reasonCode: 'planner_failed' }." The planner is an
 * advisory routing stage — a timeout, transport error, or double JSON-repair
 * failure must degrade to a direct answer, never kill the turn. A CALLER
 * abort is NOT a planner failure and always propagates (the orchestrator
 * drops the partial per D-45).
 *
 * Zero-tool runtime specialization (plan 03-01 header): when the registered
 * tool list is empty the production planner schema contains only `answer`
 * and `ask_clarification` — never `z.enum([])`, never an unrestricted
 * production `toolName` string. The base three-variant run_tool variant stays
 * available (buildPlannerDecisionSchema with a non-empty list) for direct
 * Executor contract tests and later tool-owning phases.
 *
 * Appendix I rule: no component or hook may call PlannerService directly —
 * only AgentOrchestrator (plan 03-06).
 */

/** §1.2: planner timeout is 3 seconds. */
export const PLANNER_TIMEOUT_MS = 3_000;

export interface PlannerInput {
  /** Phase-1 OperationId correlation (Flag C). */
  operationId: string;
  providerId: ProviderId;
  model: string;
  /** The user's request / task to plan against. */
  prompt: string;
  /**
   * Closed tool-name list supplied by ExecutorService (plan 03-04).
   * Empty list → production schema has only `answer` + `ask_clarification`.
   */
  toolNames: readonly string[];
  /** JSON-mode provider call (Appendix L); each provider sets its flag natively. */
  callProviderJsonMode: (prompt: string, jsonSchema: unknown, signal: AbortSignal) => Promise<string>;
  abortSignal?: AbortSignal;
  /** Override the §1.2 3s timeout (tests may tighten it). */
  timeoutMs?: number;
}

export type PlannerService = {
  plan(input: PlannerInput): Promise<PlannerDecision>;
};

/**
 * Build the runtime planner decision schema from the registered tool list.
 *
 * - Empty list: answer | ask_clarification only (zero-tool runtime).
 * - Non-empty: answer | run_tool(toolName ∈ closed enum) | ask_clarification.
 *
 * The closed `z.enum` derives from the registered tool names, so the model
 * can never emit an unregistered toolName.
 */
export function buildPlannerDecisionSchema(
  toolNames: readonly string[],
): z.ZodType<PlannerDecision> {
  if (toolNames.length === 0) {
    return z.discriminatedUnion('action', [
      z.object({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
      z.object({
        action: z.literal('ask_clarification'),
        question: z.string().max(200),
        options: z.array(z.string().max(60)).max(4).default([]),
      }),
    ]);
  }
  return z.discriminatedUnion('action', [
    z.object({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
    z.object({
      action: z.literal('run_tool'),
      toolName: z.enum(toolNames as [string, ...string[]]),
      input: z.unknown(),
    }),
    z.object({
      action: z.literal('ask_clarification'),
      question: z.string().max(200),
      options: z.array(z.string().max(60)).max(4).default([]),
    }),
  ]);
}

export async function plan(input: PlannerInput): Promise<PlannerDecision> {
  const schema = buildPlannerDecisionSchema(input.toolNames);
  const ctx: StructuredOutputContext = {
    operationId: input.operationId,
    providerId: input.providerId,
    model: input.model,
    timeoutMs: input.timeoutMs ?? PLANNER_TIMEOUT_MS,
    callProviderJsonMode: input.callProviderJsonMode,
    abortSignal: input.abortSignal ?? new AbortController().signal,
  };
  try {
    return await requestJson(schema, input.prompt, ctx);
  } catch (err) {
    // §1.2 (spec 294): planner failure → fallback to a direct answer. The
    // planner is an advisory routing step; it must never block the turn.
    // A caller abort propagates untouched (D-45: partial dropped, no
    // persist) — it is not a planner failure.
    if (ctx.abortSignal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err;
    }
    debugLog('PLANNER_FAILED', err instanceof Error ? err.message : String(err), {
      operationId: input.operationId,
      providerId: input.providerId,
      model: input.model,
      reasonCode: 'planner_failed',
    });
    return { action: 'answer', reasonCode: 'planner_failed' };
  }
}

export const PlannerService: PlannerService = { plan };