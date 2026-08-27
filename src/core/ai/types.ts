import { z } from 'zod';

/**
 * Spine types for the Phase 3 AI runtime (plan 03-01).
 *
 * These are the canonical, write-for-keeps shapes the rest of the phase
 * builds on: provider identity (D-56), runtime tiers, the §1.2 planner
 * decision contract, the D-47 canonical stream-event union, the A8
 * prompt-section contract (consumed by Phase 5's ContextOptimizer),
 * and the §1.5 router attempt state.
 *
 * Every cross-boundary shape is zod-validated (CLAUDE.md convention).
 */

/** Provider identity — spec §8.5 + D-56. Disk 'claude' maps to 'anthropic'
 * at the registry normalization boundary (plan 03-05), never here. */
export const ProviderIdSchema = z.enum([
  'openai',
  'anthropic',
  'gemini',
  'ollama',
  'openai-compat',
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

/** Runtime model tiers — exactly 'fast' | 'balanced' (Appendix D, §0.5.1 rule 2). */
export const ModelTierSchema = z.enum(['fast', 'balanced']);
export type ModelTier = z.infer<typeof ModelTierSchema>;

/**
 * Planner decision — §1.2 discriminated union, verbatim (spec 272-286).
 *
 * The `run_tool` variant carries an unrestricted `toolName` string at the
 * base level; PlannerService narrows it to a closed `z.enum` derived from
 * the registered tool list at request time (zero-tool runtime
 * specialization — see PlannerService.buildPlannerDecisionSchema).
 */
export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.object({
    action: z.literal('run_tool'),
    toolName: z.string().max(64), // ExecutorService supplies a closed z.enum at request time
    input: z.unknown(),
  }),
  z.object({
    action: z.literal('ask_clarification'),
    question: z.string().max(200),
    options: z.array(z.string().max(60)).max(4).default([]), // RICH-C-04 option chips
  }),
]);
export type PlannerDecision = z.infer<typeof PlannerDecisionSchema>;

/** Canonical §21.6 error codes surfaced on the stream boundary. Closed set —
 * no invented codes (D-38). */
export const StreamErrorCodeSchema = z.enum([
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK',
  'PROVIDER_5XX',
  'PROVIDER_AUTH',
  'PROVIDER_MODEL_UNKNOWN',
  'SCHEMA_INVALID',
]);
export type StreamErrorCode = z.infer<typeof StreamErrorCodeSchema>;

/**
 * Canonical stream-event union (D-47).
 *
 * Emitted by StreamAdapter per-provider wire parsers. Every event carries the
 * Phase-1 `OperationId` (Flag C) — no new id scheme. STREAM_START precedes
 * the first delta; STREAM_COMPLETE fires on the terminator; STREAM_ERROR
 * fires when the stream is malformed/truncated (REQ-R09: missing terminator =
 * error); STREAM_ABORTED fires on caller abort.
 */
export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('STREAM_START'), operationId: z.string() }),
  z.object({ type: z.literal('STREAM_DELTA'), operationId: z.string(), delta: z.string() }),
  z.object({ type: z.literal('STREAM_COMPLETE'), operationId: z.string(), fullText: z.string() }),
  z.object({
    type: z.literal('STREAM_ERROR'),
    operationId: z.string(),
    code: StreamErrorCodeSchema,
    message: z.string(),
  }),
  z.object({ type: z.literal('STREAM_ABORTED'), operationId: z.string() }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

/**
 * Prompt section — A8 contract (exact field names so Phase 5's
 * ContextOptimizer can adopt it). `stable` marks cache-eligible sections
 * (byte-identical across calls, §1.3); `tokens` is the section's token
 * estimate for budget bookkeeping.
 */
export const PromptSectionSchema = z.object({
  kind: z.string(),
  text: z.string(),
  stable: z.boolean(),
  tokens: z.number().int().nonnegative(),
});
export type PromptSection = z.infer<typeof PromptSectionSchema>;

/** Per-attempt record for a router operation (§1.5). */
export interface ProviderAttempt {
  providerId: ProviderId;
  startedAt: number;
  durationMs?: number;
  /** Canonical §21.6 code on failure; absent while the attempt is in flight. */
  code?: StreamErrorCode;
  streamedFirstToken: boolean;
}

/** Router attempt state — §1.5 verbatim (spec 377-383). */
export interface RouterAttemptState {
  operationId: string;
  attempts: ProviderAttempt[];
  hasStreamedFirstToken: boolean;
  circuitBreakerOpen: Record<ProviderId, number>; // reopen after cool-down ms
}

/** Tool execution result — §1.2 ExecutorService output contract. */
export interface ToolExecutionResult<T = unknown> {
  toolName: string;
  ok: boolean;
  data: T | null;
  error: string | null;
  durationMs: number;
}