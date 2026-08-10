// src/core/ai/PlannerService.ts — Source: PRODUCT_SPEC §1.2 PlannerService
// (lines 258-287) + Appendix L + AI-SPEC Seam 2 (D-18/D-19) + 03-04 F-4.
// PlannerDecisionSchema is the §1.2 closed discriminated union; the run_tool
// branch is driven by buildToolNameEnum (D-05, 03-03): when ZERO tools are
// registered the branch is OMITTED (never z.enum([]), which Zod rejects) and a
// stray run_tool decision is rejected at the schema gate (and independently by
// ExecutorService → TOOL_REJECTED, D-04/T-03-04-03).
//
// D-19 purity: plan() NEVER imports ProviderRouter and NEVER assembles or joins
// a prompt string (Golden Rule 3) — the F-4 sections-in shape threads
// OptimizedContext.sections (D-02/D-07, built by the Phase-3 context helper /
// Phase-4 ContextOptimizer) straight into requestJson; the Router-constructed
// callProviderJsonMode (Seam 2) owns the kind → system/prompt mapping.
// `userInput` is carried for the Appendix-I call shape but is NOT used here —
// the user_input PromptSection inside context.sections is the prompt source.
import { z } from 'zod';

import { BUILTIN_TOOLS, buildToolNameEnum } from '@/core/ai/toolSchemas';
import type { ToolSchemaRef } from '@/core/ai/toolSchemas';
import { requestJson } from '@/core/ai/StructuredOutput';
import type { StructuredOutputContext } from '@/core/ai/StructuredOutput';
import type { OptimizedContext, ProviderId } from '@/core/ai/types';

// §1.2 answer branch.
const AnswerDecisionSchema = z.object({
  action: z.literal('answer'),
  reasonCode: z.string().max(64),
});

// §1.2 ask_clarification branch — the RICH-C-01 runtime substrate (§17.7); the
// options array (0-4 short strings) carries the clarification chips directly.
const AskClarificationDecisionSchema = z.object({
  action: z.literal('ask_clarification'),
  question: z.string().max(200),
  options: z.array(z.string().max(60)).max(4).default([]),
});

/**
 * D-05: build the §1.2 closed PlannerDecisionSchema over the REGISTERED tools.
 * The run_tool branch's toolName is the closed z.enum from buildToolNameEnum —
 * when zero tools are registered the enum is null and the branch is OMITTED
 * (z.enum([]) is rejected by Zod). A model emitting a run_tool decision then
 * fails the schema (→ one repair → STRUCTURED_OUTPUT_FAILED at the planner
 * gate; the Executor independently TOOL_REJECTs any unvalidated toolName).
 */
export function buildPlannerDecisionSchema(tools: readonly ToolSchemaRef[]) {
  const toolEnum = buildToolNameEnum(tools);
  if (toolEnum === null) {
    return z.discriminatedUnion('action', [AnswerDecisionSchema, AskClarificationDecisionSchema]);
  }
  const runToolBranch = z.object({
    action: z.literal('run_tool'),
    toolName: toolEnum, // closed enum — the model can only select registered tools
    input: z.unknown(),
  });
  return z.discriminatedUnion('action', [
    AnswerDecisionSchema,
    runToolBranch,
    AskClarificationDecisionSchema,
  ]);
}

/** The one Zod-validated decision the Planner may emit (Appendix I). */
export type PlannerDecision =
  | { action: 'answer'; reasonCode: string }
  | { action: 'run_tool'; toolName: string; input: unknown }
  | { action: 'ask_clarification'; question: string; options: string[] };

export interface PlanInput {
  operationId: string;
  /** D-02/D-07 §2.3 shape — its sections thread into requestJson (F-4). */
  context: OptimizedContext;
  /** Appendix-I verbatim call shape; NEVER joined into any prompt (F-4). */
  userInput: string;
  abortSignal: AbortSignal;
  /** planner timeout (3s §1.2 / Appendix L timeoutMs). */
  timeoutMs: number;
  /** D-18: the Router resolves (providerId, model) after any failover. */
  providerId: ProviderId;
  model: string;
  /** Seam-2 callback (Router-constructed, D-18) — F-4 sections-in signature. */
  callProviderJsonMode: StructuredOutputContext['callProviderJsonMode'];
}

export const PlannerService = {
  plan,
};

export async function plan(input: PlanInput): Promise<PlannerDecision> {
  const schema = buildPlannerDecisionSchema(BUILTIN_TOOLS);
  const ctx: StructuredOutputContext = {
    operationId: input.operationId,
    providerId: input.providerId,
    model: input.model,
    timeoutMs: input.timeoutMs,
    callProviderJsonMode: input.callProviderJsonMode,
    abortSignal: input.abortSignal,
  };
  // The .default([]) on ask_clarification.options makes the schema's INPUT shape
  // (options optional) differ from its OUTPUT shape (options required), so the
  // inferred safeParse output carries the optional variant too; the spec's own
  // Appendix I casts the decision at this boundary. The explicit cast names the
  // stable output contract (PlannerDecision).
  return (await requestJson(schema, input.context.sections, ctx)) as PlannerDecision;
}
