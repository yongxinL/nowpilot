import type { ILLMProvider, LLMStreamRequest } from './ILLMProvider';
import type {
  ModelTier,
  ProviderAttempt,
  ProviderId,
  RouterAttemptState,
  StreamErrorCode,
  StreamEvent,
} from './types';
import { debugLog } from '../log/debugLog';

/**
 * ProviderRouter — §1.5 Provider Routing and Fallback + §20.10 Provider
 * Retry / Circuit Breaker (plan 03-05, Task 3).
 *
 * The LOCKED §20.10 table (spec 3215-3229) is implemented verbatim:
 *
 *   TIMEOUT         retryable pre-first-token YES · CB vote 1
 *   PROVIDER_5XX    retryable YES · CB vote 1
 *   NETWORK         retryable YES · CB vote 1
 *   RATE_LIMITED    retryable YES (with jitter) · CB vote 0
 *   AUTH            retryable NO · CB vote 3 (open immediately)
 *   MODEL_UNKNOWN   retryable NO · CB vote 0
 *   SCHEMA_INVALID  retryable NO · CB vote 0
 *   HOST_NOT_PERMITTED retryable NO · CB vote 0
 *
 *   3 votes within 60 s → provider open for 5 minutes (skipped while open).
 *
 * §1.5 fallback rules:
 *   - If only one provider exists, retry once ONLY for retryable
 *     pre-first-token failures.
 *   - NEVER switch provider after hasStreamedFirstToken === true.
 *   - Never silently switch local→cloud when allowCloudFallbackFromLocal=false.
 *
 * Correlation reuses the Phase-1 OperationId (Flag C). Every attempt is
 * recorded via debugLog only (AITransactionLog is Phase 11) — codes and
 * providerId only, never request bodies or keys (T-3-17).
 *
 * D-54a: the router never infers/auto-assigns/substitutes a model — the
 * caller supplies `modelForProvider` (tier-resolved via TierResolver); a
 * candidate without a resolved model is skipped as PROVIDER_MODEL_UNKNOWN.
 */

/** Circuit breaker: 3 votes within 60 s → open for 5 min (§20.10, spec 3228). */
export const CIRCUIT_BREAKER_VOTES = 3;
export const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
export const CIRCUIT_OPEN_MS = 300_000;

/**
 * Router-level error codes — the §20.10 locked table over the canonical
 * §21.6 set (D-38: no invented codes). HOST_NOT_PERMITTED is a canonical
 * §21.6 code (CORSProxy, Phase 17); no provider emits it today.
 */
export type RouterErrorCode = StreamErrorCode | 'HOST_NOT_PERMITTED';

/** §20.10 locked table — verbatim (spec 3215-3229). */
export const RETRY_TABLE: Readonly<Record<RouterErrorCode, { retryable: boolean; cbVote: number }>> = {
  TIMEOUT: { retryable: true, cbVote: 1 },
  PROVIDER_5XX: { retryable: true, cbVote: 1 },
  NETWORK: { retryable: true, cbVote: 1 },
  RATE_LIMITED: { retryable: true, cbVote: 0 },
  PROVIDER_AUTH: { retryable: false, cbVote: 3 },
  PROVIDER_MODEL_UNKNOWN: { retryable: false, cbVote: 0 },
  SCHEMA_INVALID: { retryable: false, cbVote: 0 },
  HOST_NOT_PERMITTED: { retryable: false, cbVote: 0 },
};

/** Canonical-code error surfaced when the route cannot find a working provider. */
export class RouterError extends Error {
  readonly code: RouterErrorCode;
  constructor(code: RouterErrorCode, message: string) {
    super(message);
    this.name = 'RouterError';
    this.code = code;
  }
}

/** Providers treated as "local" for the allowCloudFallbackFromLocal rule (§1.5). */
const LOCAL_PROVIDERS: ReadonlySet<ProviderId> = new Set(['ollama', 'openai-compat']);

// ---------------------------------------------------------------------------
// Circuit-breaker state — module-level, ACROSS operations (§20.10: 3 votes
// within 60 s regardless of which operation cast them)
// ---------------------------------------------------------------------------

/** Vote timestamps inside the current window, per provider. */
const breakerVotes = new Map<ProviderId, number[]>();
/** Epoch ms at which a provider reopens. */
const openUntil = new Map<ProviderId, number>();

function isLocal(provider: ILLMProvider): boolean {
  return LOCAL_PROVIDERS.has(provider.providerId);
}

/** Cast `vote` (0..3) for a provider; 3 votes within the window opens it. */
function recordVote(providerId: ProviderId, vote: number, now: number): void {
  if (vote <= 0) return;
  const windowStart = now - CIRCUIT_BREAKER_WINDOW_MS;
  const votes = (breakerVotes.get(providerId) ?? []).filter((t) => t > windowStart);
  for (let i = 0; i < vote; i++) votes.push(now);
  breakerVotes.set(providerId, votes);
  if (votes.length >= CIRCUIT_BREAKER_VOTES) {
    const until = now + CIRCUIT_OPEN_MS;
    openUntil.set(providerId, until);
    breakerVotes.set(providerId, []);
    debugLog('ROUTER_CIRCUIT_OPEN', `${providerId} opened until ${new Date(until).toISOString()}`, {
      providerId,
    });
  }
}

/** Copy the module-level open set into a per-operation RouterAttemptState view. */
function syncBreakerToState(state: RouterAttemptState): void {
  const now = Date.now();
  for (const [pid, until] of openUntil) {
    if (until > now) state.circuitBreakerOpen[pid] = until;
  }
}

// ---------------------------------------------------------------------------
// Route input / result contracts
// ---------------------------------------------------------------------------

export interface ProviderRouteInput {
  /** Phase-1 OperationId correlation (Flag C). */
  operationId: string;
  /** Tier being routed (informational — the router is tier-agnostic by design). */
  tier: ModelTier;
  /** System prompt for the attempt (persona assembly happens upstream, D-59). */
  systemPrompt: string;
  /** Ordered provider candidates — from ProviderRegistry.getEnabled() (D-51). */
  providerCandidates: ILLMProvider[];
  /**
   * Tier-resolved model per candidate provider (D-54/D-54a). The router
   * NEVER infers, auto-assigns, or substitutes a model — a candidate with no
   * resolved model is skipped as PROVIDER_MODEL_UNKNOWN.
   */
  modelForProvider: (providerId: ProviderId) => string | undefined;
  /** Caller abort — surfaces as STREAM_ABORTED, never re-routed. */
  abortSignal?: AbortSignal;
  /** §1.5: when false, never silently switch local→cloud. */
  allowCloudFallbackFromLocal: boolean;
  /** Per-operation attempt state (optional — a fresh one is created). */
  state?: RouterAttemptState;
}

export type ProviderRouteResult =
  | {
      ok: true;
      providerId: ProviderId;
      /** Canonical events for the winning provider — NEVER switches mid-stream. */
      events: AsyncIterable<StreamEvent>;
      state: RouterAttemptState;
    }
  | { ok: false; error: RouterError; state: RouterAttemptState };

// ---------------------------------------------------------------------------
// route()
// ---------------------------------------------------------------------------

/**
 * Route one operation to the best eligible provider per §1.5/§20.10.
 *
 * Flow: filter breaker-open providers (+ the local→cloud rule) → attempt each
 * eligible candidate in order → on a pre-first-token failure cast the locked
 * table's CB vote and fall through to the next candidate → with a single
 * provider, retry ONCE for retryable pre-first-token failures (RATE_LIMITED
 * with jitter). Once a provider streams its first token the result is locked
 * and the stream is returned as-is — later STREAM_ERROR events flow through
 * to the caller, never re-routed (§1.5 "never switch after first token").
 */
/** Fresh per-operation attempt state (§1.5 spec 377-383). The circuit-breaker
 * view starts empty — it is populated from the module-level open set. */
function freshState(operationId: string): RouterAttemptState {
  return {
    operationId,
    attempts: [],
    hasStreamedFirstToken: false,
    // Partial-by-design: entries are added as providers open (a fully-typed
    // Record requires every key up front; the empty object is the initial
    // "nothing open" view).
    circuitBreakerOpen: {} as Record<ProviderId, number>,
  };
}

export async function route(input: ProviderRouteInput): Promise<ProviderRouteResult> {
  const state: RouterAttemptState = input.state ?? freshState(input.operationId);

  const now = Date.now();
  syncBreakerToState(state);

  const candidates = eligibleCandidates(input.providerCandidates, input.allowCloudFallbackFromLocal, now);
  if (candidates.length === 0) {
    const error = new RouterError('NETWORK', 'no eligible provider candidates (all open or blocked)');
    debugLog('ROUTER_NO_CANDIDATES', error.message, { operationId: input.operationId });
    return { ok: false, error, state };
  }

  debugLog('ROUTER_START', `routing ${input.tier} tier across ${candidates.length} candidates`, {
    operationId: input.operationId,
    tier: input.tier,
  });

  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i];

    let attempt = await runAttempt(provider, input, state);
    if (attempt.kind === 'ok') {
      syncBreakerToState(state);
      return { ok: true, providerId: provider.providerId, events: attempt.events, state };
    }
    if (attempt.kind === 'aborted') {
      syncBreakerToState(state);
      const error = new RouterError('NETWORK', 'routing aborted by caller');
      return { ok: false, error, state };
    }

    // Pre-first-token failure — cast the locked-table CB vote (§20.10).
    const code: StreamErrorCode = attempt.code;
    recordVote(provider.providerId, RETRY_TABLE[code]?.cbVote ?? 0, now);
    const verdict = RETRY_TABLE[code] ?? { retryable: false, cbVote: 0 };

    // §1.5: with a SINGLE provider, retry once for retryable pre-first-token
    // failures. RATE_LIMITED retries with jitter (locked table).
    if (verdict.retryable && candidates.length === 1) {
      if (code === 'RATE_LIMITED') {
        await sleep(jitterMs());
      }
      debugLog('ROUTER_RETRY', `retrying ${provider.providerId} after ${code}`, {
        operationId: input.operationId,
        providerId: provider.providerId,
        code,
      });
      const retry = await runAttempt(provider, input, state);
      if (retry.kind === 'ok') {
        syncBreakerToState(state);
        return { ok: true, providerId: provider.providerId, events: retry.events, state };
      }
      if (retry.kind === 'aborted') {
        syncBreakerToState(state);
        return { ok: false, error: new RouterError('NETWORK', 'routing aborted by caller'), state };
      }
      recordVote(provider.providerId, RETRY_TABLE[retry.code]?.cbVote ?? 0, Date.now());
      syncBreakerToState(state);
      return {
        ok: false,
        error: new RouterError(retry.code, retry.message),
        state,
      };
    }

    // Multiple candidates: fall back to the next enabled provider.
    if (i === candidates.length - 1) {
      syncBreakerToState(state);
      return { ok: false, error: new RouterError(code, attempt.message), state };
    }
    debugLog('ROUTER_FALLBACK', `switching provider after ${code}`, {
      operationId: input.operationId,
      from: provider.providerId,
      code,
    });
  }

  // Unreachable — candidates.length > 0 guarantees a return inside the loop.
  syncBreakerToState(state);
  return {
    ok: false,
    error: new RouterError('NETWORK', 'route exhausted without a successful attempt'),
    state,
  };
}

// ---------------------------------------------------------------------------
// Attempt execution — pull events until the first token or a pre-token failure
// ---------------------------------------------------------------------------

type AttemptOutcome =
  | { kind: 'ok'; events: AsyncIterable<StreamEvent> }
  | { kind: 'failed'; code: StreamErrorCode; message: string }
  | { kind: 'aborted' };

/**
 * Start one provider attempt and consume its event stream until either the
 * first token arrives (STREAM_START/STREAM_DELTA — the result is locked,
 * never switched) or a pre-first-token failure (STREAM_ERROR/abort/end).
 */
async function runAttempt(
  provider: ILLMProvider,
  input: ProviderRouteInput,
  state: RouterAttemptState,
): Promise<AttemptOutcome> {
  const startedAt = Date.now();
  const attempt: ProviderAttempt = {
    providerId: provider.providerId,
    startedAt,
    streamedFirstToken: false,
  };

  const model = input.modelForProvider(provider.providerId);
  if (model === undefined || model === '') {
    // D-54a: no resolved model → no provider request starts; the candidate
    // is treated as an unresolved (non-retryable) failure and the chain moves on.
    attempt.code = 'PROVIDER_MODEL_UNKNOWN';
    attempt.durationMs = Date.now() - startedAt;
    state.attempts.push(attempt);
    debugLog('ROUTER_ATTEMPT', `${provider.providerId} skipped — no resolved model`, {
      operationId: input.operationId,
      providerId: provider.providerId,
      code: 'PROVIDER_MODEL_UNKNOWN',
    });
    return {
      kind: 'failed',
      code: 'PROVIDER_MODEL_UNKNOWN',
      message: `${provider.providerId}: no model resolved for route (TierResolver must supply it)`,
    };
  }

  const request: LLMStreamRequest = {
    operationId: input.operationId,
    providerId: provider.providerId,
    model,
    messages: [{ role: 'system', content: input.systemPrompt }],
  };

  let iter: AsyncIterator<StreamEvent>;
  try {
    iter = provider.stream(request, input.abortSignal)[Symbol.asyncIterator]();
  } catch (err) {
    attempt.code = 'NETWORK';
    attempt.durationMs = Date.now() - startedAt;
    state.attempts.push(attempt);
    debugLog('ROUTER_ATTEMPT', `${provider.providerId} stream() threw synchronously`, {
      operationId: input.operationId,
      providerId: provider.providerId,
      code: 'NETWORK',
    });
    return { kind: 'failed', code: 'NETWORK', message: err instanceof Error ? err.message : String(err) };
  }

  const buffered: StreamEvent[] = [];
  for (;;) {
    let next: IteratorResult<StreamEvent>;
    try {
      next = await iter.next();
    } catch (err) {
      if (input.abortSignal?.aborted) return { kind: 'aborted' };
      attempt.code = 'NETWORK';
      attempt.durationMs = Date.now() - startedAt;
      state.attempts.push(attempt);
      debugLog('ROUTER_ATTEMPT', `${provider.providerId} iterator threw pre-token`, {
        operationId: input.operationId,
        providerId: provider.providerId,
        code: 'NETWORK',
      });
      return { kind: 'failed', code: 'NETWORK', message: err instanceof Error ? err.message : String(err) };
    }

    if (next.done) {
      // Stream ended without a first token and without a terminal event —
      // a truncated stream (REQ-R09 discipline: never a silent success).
      await iter.return?.();
      attempt.code = 'NETWORK';
      attempt.durationMs = Date.now() - startedAt;
      state.attempts.push(attempt);
      debugLog('ROUTER_ATTEMPT', `${provider.providerId} ended before first token`, {
        operationId: input.operationId,
        providerId: provider.providerId,
        code: 'NETWORK',
      });
      return {
        kind: 'failed',
        code: 'NETWORK',
        message: `${provider.providerId}: stream ended before the first token`,
      };
    }

    const event = next.value;
    buffered.push(event);

    if (event.type === 'STREAM_ABORTED') {
      // Caller abort — propagate, never fall back.
      await iter.return?.();
      return { kind: 'aborted' };
    }

    if (event.type === 'STREAM_ERROR') {
      attempt.code = event.code;
      attempt.durationMs = Date.now() - startedAt;
      state.attempts.push(attempt);
      debugLog('ROUTER_ATTEMPT', `${provider.providerId} failed pre-first-token`, {
        operationId: input.operationId,
        providerId: provider.providerId,
        code: event.code,
      });
      return { kind: 'failed', code: event.code, message: event.message };
    }

    if (event.type === 'STREAM_START') {
      // CR-03: a bare STREAM_START is NOT the first-token lock point — the
      // adapter emits it before any parsed delta, so an empty/truncated/
      // error-first stream would lock a provider that produced zero tokens
      // and silently defeat the §1.5 fallback for exactly the wire failures
      // REQ-R09 targets. The event stays buffered; the lock fires only on
      // the first STREAM_DELTA below.
      continue;
    }

    if (event.type === 'STREAM_DELTA') {
      // First token — the result is LOCKED to this provider (§1.5: never
      // switch after hasStreamedFirstToken === true). Buffered events are
      // replayed through the passthrough so the caller sees them in order.
      state.hasStreamedFirstToken = true;
      attempt.streamedFirstToken = true;
      attempt.durationMs = Date.now() - startedAt;
      state.attempts.push(attempt);
      debugLog('ROUTER_ATTEMPT', `${provider.providerId} streaming (first token)`, {
        operationId: input.operationId,
        providerId: provider.providerId,
      });
      return { kind: 'ok', events: passthrough(iter, buffered) };
    }

    if (event.type === 'STREAM_COMPLETE') {
      // Defensive: an empty completed stream (adapter normally emits
      // STREAM_START first, so this is near-unreachable) is committed too.
      state.hasStreamedFirstToken = true;
      attempt.streamedFirstToken = true;
      attempt.durationMs = Date.now() - startedAt;
      state.attempts.push(attempt);
      return { kind: 'ok', events: passthrough(iter, buffered) };
    }
  }
}

/** Replay buffered events, then continue the winning provider's stream as-is. */
async function* passthrough(
  iter: AsyncIterator<StreamEvent>,
  buffered: StreamEvent[],
): AsyncIterable<StreamEvent> {
  for (const event of buffered) yield event;
  for (;;) {
    const { done, value } = await iter.next();
    if (done) return;
    yield value;
  }
}

// ---------------------------------------------------------------------------
// Candidate eligibility (§1.5 + §20.10)
// ---------------------------------------------------------------------------

/**
 * Filter breaker-open providers, then apply the §1.5 local→cloud rule: when
 * allowCloudFallbackFromLocal=false and the PRIMARY candidate is local, the
 * fallback chain is restricted to local providers (never silently switch
 * local→cloud). A cloud primary keeps the full chain (cloud→local is allowed).
 */
function eligibleCandidates(
  candidates: ILLMProvider[],
  allowCloudFallbackFromLocal: boolean,
  now: number,
): ILLMProvider[] {
  const notOpen = candidates.filter((p) => (openUntil.get(p.providerId) ?? 0) <= now);
  if (allowCloudFallbackFromLocal) return notOpen;
  const first = notOpen[0];
  if (first === undefined) return [];
  if (isLocal(first)) return notOpen.filter((p) => isLocal(p));
  return notOpen;
}

// ---------------------------------------------------------------------------
// RATE_LIMITED retry jitter (locked table) — injectable for deterministic tests
// ---------------------------------------------------------------------------

let jitterMsFn: () => number = () => 50 + Math.floor(Math.random() * 200);

function jitterMs(): number {
  return jitterMsFn();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Test seams — exported only for unit tests (`__test__` prefix convention).
// Production code must NOT use these.
// ---------------------------------------------------------------------------

export const __test__ = {
  resetBreaker(): void {
    breakerVotes.clear();
    openUntil.clear();
  },
  isOpen(providerId: ProviderId): boolean {
    return (openUntil.get(providerId) ?? 0) > Date.now();
  },
  voteCount(providerId: ProviderId): number {
    return breakerVotes.get(providerId)?.length ?? 0;
  },
  setJitter(fn: () => number): void {
    jitterMsFn = fn;
  },
};