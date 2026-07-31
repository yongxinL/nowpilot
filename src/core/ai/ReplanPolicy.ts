import type { ReplanContext } from './types';

/**
 * Closed disposition union of the deterministic replan policy (D-14).
 * `continue-planning`: verified/ordinary tool success — the loop continues.
 * `replan`: exactly one additional recovery PlannerService pass.
 * `render`: skip to rendering with partial results.
 * `terminate`: stop immediately, no retry.
 */
export type ReplanDisposition = 'continue-planning' | 'replan' | 'render' | 'terminate';

/**
 * Codes that terminate without bypass (D-13/D-15): permission/auth,
 * schema, unknown tool, invalid input, and unresolved idempotency state.
 * ABORTED is handled by the abort rule ahead of this set. Other terminal
 * technical failures (cap exhaustion, model unknown, etc.) render partial.
 */
const TERMINATE_CODES: ReadonlySet<string> = new Set([
  'PROVIDER_AUTH',
  'SCHEMA_INVALID',
  'NO_SUCH_TOOL',
  'INVALID_TOOL_INPUT',
  'TOOL_IDEMPOTENCY_CONFLICT',
]);

/**
 * Pure, stateless replan decision function (D-12). Consumes the immutable
 * redacted ReplanContext and returns only the closed disposition union —
 * no service imports, no counters, no timers, no mutation. Evaluation
 * priority:
 *
 * 1. abort/cancellation terminates before every other rule;
 * 2. permission/auth/schema/unknown-tool/invalid-input/idempotency
 *    failures terminate without bypass;
 * 3. an irreversible tool that started or may have taken effect terminates
 *    on failure or unverified evidence — never replays;
 * 4. planner/tool cap exhaustion renders partial;
 * 5. verified success or ordinary non-side-effecting continuation resumes
 *    the loop (replanCount is NOT incremented);
 * 6. a second recovery request renders — one replan is the cap;
 * 7. a retryable execution failure replans only when the effect is proven
 *    not to have started (failed-before-effect);
 * 8. a retryable evidence failure (verification timeout) replans once;
 * 9. otherwise render partial.
 *
 * Permission grants never reach this function: the orchestrator resumes
 * the same validated decision (D-15); denial terminates without bypass.
 */
export function evaluateReplan(context: ReplanContext): ReplanDisposition {
  if (context.aborted === true || context.cause?.code === 'ABORTED') {
    return 'terminate';
  }

  if (context.cause && TERMINATE_CODES.has(context.cause.code)) {
    return 'terminate';
  }

  const lastResult = context.priorToolResults.length > 0
    ? context.priorToolResults[context.priorToolResults.length - 1]
    : undefined;
  const lastEvidence = lastResult?.evidence;
  const failurePath = context.cause !== undefined || (lastEvidence !== undefined && !lastEvidence.verified);

  // D-13: after an irreversible tool starts or may have taken effect, any
  // failure or unverified evidence terminates — no retry, no replan.
  if (context.sideEffect === 'irreversible' && failurePath) {
    return 'terminate';
  }

  // Cap exhaustion renders partial — the loop cannot continue regardless
  // of the last tool's verification state.
  if (context.caps && (context.caps.plannerCapReached || context.caps.toolCapReached)) {
    return 'render';
  }

  // Verified success or ordinary continuation resumes the loop without
  // consuming the one-replan budget (D-14/D-15). A "second recovery
  // request" below applies to failure paths only, so a verified tool after
  // one recovery still continues.
  if (context.cause === undefined && (lastEvidence?.verified === true || lastEvidence === undefined)) {
    return 'continue-planning';
  }

  // One additional recovery pass is the entire replan budget (D-15).
  if (context.replanCount > 0) {
    return 'render';
  }

  // Retryable execution failure replans only on proven failed-before-effect;
  // unknown effect state never re-executes (D-17).
  if (context.cause?.retryable === true && context.effectKnownNotStarted === true) {
    return 'replan';
  }

  // Retryable evidence failure (verifier timeout) permits one recovery pass.
  if (context.cause === undefined && lastEvidence !== undefined && !lastEvidence.verified && lastEvidence.retryable === true) {
    return 'replan';
  }

  return 'render';
}
