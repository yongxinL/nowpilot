import { CompletionEvidenceSchema } from '../AgentTurnOutcome';
import type {
  CompletionEvidence,
  CompletionEvidenceCheck,
  EvidenceFailureReason,
  RegisteredTool,
  ToolExecutionResult,
} from '../types';
import { CompletionEvidenceCheckSchema } from './VerifierTypes';
import type { VerifierCheck } from './VerifierTypes';

export const OUTCOME_VERIFIER_TIMEOUT_MS = 5000;

/**
 * Bounded diagnostic hook (D-10/T-03a-12): unverified evidence with
 * failureReason `evidence_unavailable` maps to this PipelineError code in
 * the orchestrator — transport success is never treated as completion.
 */
export const OUTCOME_VERIFIER_EVIDENCE_MISSING_DIAGNOSTIC = 'COMPLETION_EVIDENCE_MISSING';

/**
 * Secret/key-like patterns rejected in stored check fields (T-03a-10).
 * Conservative by design: a matching string discards the whole check set
 * into verification_error rather than risking disclosure.
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /sk-[a-zA-Z0-9_-]{8,}/,
  /\b(api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|private[_-]?key|secret|password|authorization)\b/i,
  /\bbearer\s+[a-zA-Z0-9._~+/=-]{8,}/i,
];

type RunOutcome =
  | { kind: 'checks'; checks: CompletionEvidenceCheck[] }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
  | { kind: 'error' };

function containsSensitiveValue(check: CompletionEvidenceCheck): boolean {
  const candidates: unknown[] = [check.checkId, check.name, check.expected, check.actualRef, check.message];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && SENSITIVE_PATTERNS.some((pattern) => pattern.test(candidate))) {
      return true;
    }
  }
  return false;
}

/**
 * Dedicated postcondition verifier service (D-10) under the ratified
 * verifier directory. `verify()` always resolves to CompletionEvidence —
 * it never throws for verifier failure, timeout, missing verifier, or
 * abort; each condition maps to an explicit discriminated variant.
 */
export class OutcomeVerifier {
  /**
   * Verify one executed tool call against its registered evidence policy.
   * Required side-effecting tools can never receive implicit verified
   * status: without a declared, schema-valid checker the record is
   * unverified with `evidence_unavailable` and the COMPLETION_EVIDENCE_MISSING
   * diagnostic hook (T-03a-12).
   */
  async verify(
    toolResult: ToolExecutionResult,
    tool: RegisteredTool,
    operationId: string,
    signal?: AbortSignal,
  ): Promise<CompletionEvidence> {
    const verifiedAt = Date.now();

    // Abort wins before any other rule (D-06) and never grants retry.
    if (signal?.aborted) {
      return this.buildUnverified(toolResult, operationId, 'aborted', false, 0, verifiedAt);
    }

    const policy = tool.evidence;
    const required = policy?.required === true;
    const sideEffecting = tool.sideEffect === 'write' || tool.sideEffect === 'irreversible';

    if (!required) {
      // A non-side-effecting result may reuse validated tool-provided
      // evidence only when its policy does not require a postcondition;
      // side-effecting tools never receive implicit verification.
      if (!sideEffecting && toolResult.evidence) {
        const parsed = CompletionEvidenceSchema.safeParse(toolResult.evidence);
        if (parsed.success) {
          return parsed.data;
        }
      }
      return this.buildUnverified(toolResult, operationId, 'evidence_unavailable', false, 0, verifiedAt);
    }

    if (!toolResult.toolCallId || !operationId || !policy.verifier) {
      return this.buildUnverified(toolResult, operationId, 'evidence_unavailable', false, 0, verifiedAt);
    }

    const verifier = policy.verifier;
    const started = performance.now();
    const outcome = await this.runBounded(verifier.check, toolResult, signal);
    const durationMs = performance.now() - started;

    switch (outcome.kind) {
      case 'aborted':
        return this.buildUnverified(toolResult, operationId, 'aborted', false, durationMs, verifiedAt);
      case 'timeout':
        // The verifier itself timed out — one bounded re-verification pass
        // is permitted (must-have truth 4); the tool effect was already
        // produced by the successful execution this record verifies.
        return this.buildUnverified(toolResult, operationId, 'verification_timeout', true, durationMs, verifiedAt);
      case 'error':
        return this.buildUnverified(toolResult, operationId, 'verification_error', false, durationMs, verifiedAt);
      case 'checks': {
        const validated = this.validateChecks(outcome.checks);
        if (validated === null) {
          return this.buildUnverified(toolResult, operationId, 'verification_error', false, durationMs, verifiedAt);
        }
        if (validated.some((check) => !check.passed)) {
          return this.buildUnverified(toolResult, operationId, 'postcondition_failed', false, durationMs, verifiedAt);
        }
        return {
          id: crypto.randomUUID(),
          operationId,
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          verified: true,
          verifierType: verifier.type,
          checks: validated,
          resultRef: { type: verifier.type, ref: toolResult.toolCallId },
          verifiedAt,
          durationMs,
        };
      }
    }
  }

  /**
   * Run the declared verifier with the 5000 ms bound and the shared
   * AbortSignal. Timeout and abort race the callback; an AbortError thrown
   * by the callback normalizes to aborted (D-06). Raw error text is never
   * retained.
   */
  private async runBounded(
    check: VerifierCheck,
    result: ToolExecutionResult,
    signal?: AbortSignal,
  ): Promise<RunOutcome> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;

    const timeoutPromise: Promise<RunOutcome> = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ kind: 'timeout' }), OUTCOME_VERIFIER_TIMEOUT_MS);
    });

    const abortPromise: Promise<RunOutcome> = signal
      ? signal.aborted
        ? Promise.resolve<RunOutcome>({ kind: 'aborted' })
        : new Promise<RunOutcome>((resolve) => {
            onAbort = () => resolve({ kind: 'aborted' });
            signal.addEventListener('abort', onAbort, { once: true });
          })
      : new Promise<RunOutcome>(() => {});

    try {
      return await Promise.race<RunOutcome>([
        check(result, signal).then((checks) => ({ kind: 'checks', checks }) as RunOutcome),
        timeoutPromise,
        abortPromise,
      ]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { kind: 'aborted' };
      }
      return { kind: 'error' };
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (onAbort !== undefined && signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  }

  /**
   * Validate verifier-returned checks against the strict safe schema and
   * reject unrestricted raw output or key-like strings (T-03a-04/T-03a-10).
   * Returns null when any check is unsafe; the whole set is discarded.
   */
  private validateChecks(checks: unknown): CompletionEvidenceCheck[] | null {
    if (!Array.isArray(checks)) {
      return null;
    }
    const validated: CompletionEvidenceCheck[] = [];
    for (const raw of checks) {
      const parsed = CompletionEvidenceCheckSchema.safeParse(raw);
      if (!parsed.success || containsSensitiveValue(parsed.data)) {
        return null;
      }
      validated.push(parsed.data);
    }
    return validated;
  }

  private buildUnverified(
    toolResult: ToolExecutionResult,
    operationId: string,
    failureReason: EvidenceFailureReason,
    retryable: boolean,
    durationMs: number,
    verifiedAt: number,
  ): CompletionEvidence {
    return {
      id: crypto.randomUUID(),
      operationId,
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      verified: false,
      failureReason,
      retryable,
      verifiedAt,
      durationMs,
    };
  }
}

export const outcomeVerifier = new OutcomeVerifier();
