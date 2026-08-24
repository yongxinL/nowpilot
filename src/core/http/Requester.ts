import type { RateLimiter } from '../utils/RateLimiter';

/**
 * UI-context fetch wrapper for the Phase 3 aiProvider consumer
 * (D-35/D-37/D-38, spec §10.7).
 *
 * Runs ONLY in side panel / standalone contexts — never the background
 * service worker (§0.2 boundary, §5.2). `chrome.runtime.id`-gated
 * call sites in Phase 3 enforce this; this module itself is a plain
 * fetch wrapper with no implicit coupling.
 *
 * Error codes are the existing canonical §21.6 set — `RATE_LIMITED`,
 * `TIMEOUT`, `NETWORK`. No invented codes (REQ-R07 closed-set rule).
 *
 * `rateLimiter` is OPTIONAL (D-37 default-free): with none passed, no
 * throttling occurs, which keeps aiProvider's streaming path
 * uninstrumented until Phase 3 wires a real limiter at the consumer.
 */

export interface RequesterOptions {
  /** Override the 25 s default; matches PROXY_FETCH's Promise.race (spec §10.7). */
  timeoutMs?: number;
  /** Optional per-instance rate limiter (spec §13, D-36). */
  rateLimiter?: RateLimiter;
}

/**
 * Thrown when the injected limiter denies the request. Carries the
 * canonical `code` so callers can pattern-match without parsing messages.
 */
export class RequesterError extends Error {
  readonly code: 'RATE_LIMITED' | 'TIMEOUT' | 'NETWORK';
  constructor(code: RequesterError['code'], message: string) {
    super(message);
    this.name = 'RequesterError';
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Issue `fetch(url, init)` with an AbortController-backed timeout and
 * an optional rate-limiter gate. Returns the underlying `Response` on
 * success; throws a `RequesterError` (carrying a canonical code) on
 * rate-limit, timeout, or network failure.
 *
 * Both caller-initiated aborts (signal passed in `init.signal`) and
 * the internal timeout abort surface as `TIMEOUT` per D-35 — the
 * caller does not need to discriminate.
 */
export async function request(
  url: string,
  init: RequestInit,
  opts: RequesterOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Gate: rate-limit precedes any network work (D-37, T-02-03-02).
  if (opts.rateLimiter && !opts.rateLimiter.acquire()) {
    throw new RequesterError('RATE_LIMITED', 'Rate limit exceeded');
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  // Compose caller-supplied signal + internal timeout signal so both
  // abort paths share the same controller (AbortController's `signal`
  // property is a getter; any provided `init.signal` is overridden).
  const externalSignal = init.signal ?? null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    // AbortError — caller abort OR internal timeout. Both map to TIMEOUT
    // per D-35 (the caller does not need to discriminate).
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new RequesterError('TIMEOUT', 'Request aborted or timed out');
    }
    if (err instanceof RequesterError) {
      throw err;
    }
    // Any other failure (DNS, offline, CORS, etc.) is a NETWORK error.
    throw new RequesterError(
      'NETWORK',
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}
