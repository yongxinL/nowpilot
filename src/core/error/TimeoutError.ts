// src/core/error/TimeoutError.ts — the shared typed timeout-origin carrier
// (WR-03, 03-11). Leaf module (zero runtime imports) so BOTH consumers can
// import it without an import cycle: StructuredOutput throws it for
// timeout-origin aborts, ProviderRouter.classifyProviderError maps it to
// { code: 'TIMEOUT', retryable: true } BEFORE the isAbortError branch.
//
// Contract:
//   - StructuredOutput.attempt(): when the per-attempt setTimeout fires, the
//     timedOut flag is set BEFORE ac.abort(); the catch rethrows this carrier
//     for timeout-origin failures — never a bare AbortError.
//   - ProviderRouter.classifyProviderError(): isTimeoutError(err) →
//     { code: 'TIMEOUT', retryable: true }, making TIMEOUT (a RETRYABLE_CODES
//     member, §20.10) producible and D-17-retryable.
//   - User cancels (outer abortSignal) never set timedOut and still propagate
//     as AbortError — the two origins are never conflated (T-03-11-01).
//
// R-10: this carrier carries ONLY timeoutMs. Never attach prompt bodies,
// provider API keys, or raw provider output to it — the factory exists for
// exactly one purpose and the shape is audited by the threat register
// (T-03-11-03 Info Disclosure, mitigate).
export interface TimeoutError extends Error {
  name: 'TimeoutError';
  timeoutMs: number;
}

/**
 * Guard: name-match, prototype-chain agnostic (the isAbortError precedent at
 * ProviderRouter.ts) — `err instanceof Error && err.name === 'TimeoutError'`.
 */
export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof Error && err.name === 'TimeoutError';
}

/** Factory: builds the typed carrier carrying ONLY the timeout duration. */
export function timeoutError(timeoutMs: number): TimeoutError {
  const err = new Error(`Timeout after ${timeoutMs}ms`) as TimeoutError;
  err.name = 'TimeoutError';
  err.timeoutMs = timeoutMs;
  return err;
}
