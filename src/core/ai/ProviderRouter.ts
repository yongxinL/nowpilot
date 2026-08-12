// src/core/ai/ProviderRouter.ts — Source: PRODUCT_SPEC §1.5 (lines 360-380)
// + §20.10 (lines 3283-3296, retry/breaker votes) + AI-SPEC Seam 2 (D-18) +
// F-4 (sections-in closure) + F-5 (messages[]+providerOptions cache hints).
//
// The Router owns every cost multiplier (Pitfall 1): maxRetries: 0 on every
// constructed SDK call, exactly ONE router retry per retryable pre-first-token
// code (D-17), the §1.5 circuit breaker (3 failure-votes within 60 s → open
// 5 minutes, D-14), an explicit per-operation attempt budget (R-2 — the three
// non-multiplying retry bounds land here, §1.6.1), and explicit maxTokens on
// every call (planner/repair 256, renderer 512). It is also the D-13 privacy
// gate owner (a failing local provider NEVER hops to cloud under
// 'prefer-local') and the F-4/F-5 mapping owner (sections → system/prompt via
// the pure joinSections helper; the cached [SYSTEM] travels as a
// CoreSystemMessage carrying providerOptions.anthropic.cacheControl from
// applyCacheHints — NEVER `system: string`, which ai@4 silently drops the
// breakpoint on).
//
// WR-02A (03-15): the streaming-path breaker vote is LIVE — BREAKER_VOTES
// carries STREAM_FAILED and the renderer's mid-stream catch votes the
// classifier's mapped code (a provider failing mid-stream now accrues real
// votes; voteBreaker no longer early-returns 0 on a streaming failure).
//
// WR-03A (03-16): timeout-origin aborts are recovered from the incoming
// signal's reason INSIDE the closure (the SDK drops the reason and rejects a
// bare AbortError) — the recovery branch records the failed TIMEOUT attempt +
// votes the breaker BEFORE rethrowing the carrier, and each attempt derives a
// fresh controller so the D-17 retry never runs on the already-aborted signal.
//
// D-16: the budgetGuard hook is a no-op pass-through this phase — Phase 6 wires
// the monthly ledger pre-flight here without a rebuild.
//
// 04-05 (D-04-04/06): StageInvocation carries the REQUIRED modelContextWindow
// (Pitfall 2 — optionality would silently degrade to the pre-resolution
// fallback tier forever, inverting D-04-04), stamped by buildInvocation from
// resolveModelContextWindow — the canonical map is the SINGLE window source
// (R-1, zero model calls; getModels is a throwing stub). The hook (04-06)
// reads each stage's resolved window from its invocation for per-stage
// optimization.
//
// P-3: PromptSection is imported from '@/core/ai/types' (D-07 canonical home) —
// never re-declared (R-1). Error vocabulary is the canonical 13-code Phase-3
// block from errorCodes.ts (Golden Rule 9 — no invented codes; the spec §1.6.1
// prose 'AUTH'/'MODEL_UNKNOWN' maps to PROVIDER_AUTH/PROVIDER_MODEL_UNKNOWN).
// 'provider_unconfigured' is a typed marker on ProviderUnavailableError (a
// terminal reasonCode string), NOT an error-code constant.
import {
  APICallError,
  LoadAPIKeyError,
  NoObjectGeneratedError,
  generateObject,
  generateText,
  jsonSchema,
} from 'ai';
import type { CoreMessage, LanguageModel, ProviderMetadata } from 'ai';

import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { ErrorCode } from '@/core/error/errorCodes';
import { isTimeoutError, timeoutError } from '@/core/error/TimeoutError';
import { getAISDKModel } from '@/core/ai/ILLMProvider';
import type { GetAISDKModelConfig } from '@/core/ai/ILLMProvider';
import { applyCacheHints } from '@/core/ai/PromptCacheAdapter';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import { resolveTier } from '@/core/ai/TierResolver';
import type { ModelTier, PrivacyMode, TierResolveInput } from '@/core/ai/TierResolver';
import { resolveModelContextWindow } from '@/core/context/ModelContextTier';
import type { ProviderId, PromptSection } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// F-4: section-kind mapping (the ONLY section→string mapping site)
// ---------------------------------------------------------------------------

/** §1.3 cached kinds → provider `system` (byte-stable, prompt-cache eligible). */
export const CACHED_KINDS: ReadonlyArray<PromptSection['kind']> = [
  'system',
  'tool_schemas',
  'preferences',
  'memory',
];

/**
 * Task kinds → provider `prompt` ([CONTEXT]+[TASK]+[USER INPUT]). 03a-01:
 * 'tool_result' (D-3a-11 F-4 replan feedback) maps to `prompt` — NEVER into
 * CACHED_KINDS (per-turn, stable:false — cache-stability, Pitfall 7).
 */
export const TASK_KINDS: ReadonlyArray<PromptSection['kind']> = [
  'context',
  'task',
  'user_input',
  'tool_result',
];

/**
 * F-4: pure kind→string mapping. NEVER a `prompt.split(...)` recovery — a
 * multi-line cached section (the persona block, tool schemas) containing a
 * blank line must map WHOLE to `system` (the old split mis-sliced it).
 */
export function joinSections(
  secs: PromptSection[],
  kinds: ReadonlyArray<PromptSection['kind']>,
): string {
  return secs
    .filter((s) => kinds.includes(s.kind))
    .map((s) => s.text)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** D-18: per-provider structured-output capability. */
export type JsonMode = 'native' | 'prompt';

/**
 * F-4 (D-18): the sections-in callback handed to StructuredOutput.requestJson.
 * Only the Router hands this out — after a failover only the Router knows the
 * new (providerId, model, jsonMode) triple, so it closes over the resolved
 * candidate and resolves per-provider jsonMode internally.
 */
export type CallProviderJsonMode = (
  sections: PromptSection[],
  jsonSchema: unknown,
  signal: AbortSignal,
) => Promise<string>;

/**
 * The bundle createStageInvocation returns — the seam 03-06/03-08 consume.
 *
 * 04-05 (D-04-04/06): `modelContextWindow` is a REQUIRED field (Pitfall 2 — an
 * optional field would silently degrade to the pre-resolution fallback tier
 * forever, inverting D-04-04). buildInvocation stamps it from the canonical
 * map via resolveModelContextWindow (R-1 — the single window source, never
 * re-declared here); the stamp is synchronous and pure — ZERO model calls
 * (getModels is a throwing stub; the map IS the window source). The hook
 * (04-06) reads each stage's resolved window from its StageInvocation to run
 * per-stage optimization.
 */
export interface StageInvocation {
  providerId: ProviderId;
  model: LanguageModel;
  jsonMode: JsonMode;
  callProviderJsonMode: CallProviderJsonMode;
  /** D-04-04: the resolved model's window from the canonical map — REQUIRED. */
  modelContextWindow: number;
}

/** One provider attempt in the per-operation ledger (D-14). */
export interface ProviderAttempt {
  providerId: ProviderId;
  model: string;
  at: number;
  outcome: 'success' | 'failed';
  errorCode?: ErrorCode;
}

/**
 * D-14: per-operation (per-turn), in-memory, per-surface attempt ledger — it
 * dies on panel close; no cross-surface sharing in v0.1 (AI-04 flagged
 * assumption). `circuitBreakerOpen` snapshots the provider breaker state
 * (providerId → reopen epoch ms; absent = closed).
 *
 * CR-01 (03-10): `attempts` is the OBSERVABILITY ledger (every SDK call);
 * `retryCount` is the R-2 router-owned RETRY budget (D-17) — it counts ONLY
 * the exactly-one retried SDK call per retryable pre-first-token failure,
 * never a stage's first invocation and never a structured-output repair
 * (legitimate sequential stage calls and repairs must not consume the budget).
 */
export interface RouterAttemptState {
  operationId: string;
  attempts: ProviderAttempt[];
  /** R-2 (CR-01): only D-17 router-owned retried SDK calls increment this. */
  retryCount: number;
  hasStreamedFirstToken: boolean;
  circuitBreakerOpen: Partial<Record<ProviderId, number>>;
}

export interface CreateStageInvocationInput {
  operationId: string;
  tier: ModelTier;
  /** D-13: per-call override; falls back to the 03-09 wiring baseline (configure()). */
  privacyMode?: PrivacyMode;
  /** §1.2 output cap — planner/repair 256, renderer 512; never unbounded. */
  maxTokens: number;
  /** TierResolveInput.configuredProviders — cheapest-capable resolution input.
   *  Optional: falls back to the 03-09 wiring baseline (configure()). */
  configuredProviders?: TierResolveInput['configuredProviders'];
  /**
   * Seam: per-provider SDK config (apiKey/baseURL/fetch). The Router NEVER
   * touches the vault (Pitfall 4) — the wiring layer (03-09) supplies this.
   */
  getSDKConfig?: (providerId: ProviderId) => GetAISDKModelConfig;
  /** Test seam: defaults to the real Seam-1 getAISDKModel. */
  getModel?: typeof getAISDKModel;
}

export interface ClassifiedProviderError {
  code: ErrorCode;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Circuit breaker + retry policy (§1.5 / §20.10)
// ---------------------------------------------------------------------------

/** R-2: the Router's non-multiplying attempt budget per operation (≤3 — never 4-6 paid calls). */
export const ROUTER_MAX_ATTEMPTS = 3;
/**
 * CR-01 (04): the D-17 retried call must be bounded by ITS OWN timer — the
 * per-attempt timeout lives in StructuredOutput's one-shot setTimeout, which is
 * already consumed at retry time (timeout origin) or shared with the parent
 * (NETWORK/5XX). A hung provider on the retry would otherwise hang indefinitely
 * and bill tokens when it lands. Mirrors the §1.2 planner timeout (Appendix L
 * timeoutMs: planner 3s).
 */
export const RETRY_TIMEOUT_MS = 3_000;
/** §1.5: after this many failure-votes within the window the provider opens. */
export const BREAKER_FAILURE_THRESHOLD = 3;
/** §1.5: the vote window (3 failures within 60 s). */
export const BREAKER_WINDOW_MS = 60_000;
/** §1.5: a provider stays open for 5 minutes. */
export const BREAKER_OPEN_MS = 5 * 60_000;

/** §20.10 retryable pre-first-token codes (canonical names, Appendix C.2). */
export const RETRYABLE_CODES: ReadonlyArray<ErrorCode> = [
  'TIMEOUT',
  'PROVIDER_5XX',
  'NETWORK',
  'RATE_LIMITED',
];

/**
 * §20.10 circuit-breaker votes. RATE_LIMITED votes 0 (retryable with jitter —
 * never opens), PROVIDER_AUTH votes 3 (opens immediately), the other
 * non-retryables (MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED) vote 0.
 * WR-02A: STREAM_FAILED votes 1 — mid-stream failures open the breaker after 3
 * within the window; the renderer's catch votes the classifier's mapped code.
 */
export const BREAKER_VOTES: Readonly<Partial<Record<ErrorCode, number>>> = {
  TIMEOUT: 1,
  PROVIDER_5XX: 1,
  NETWORK: 1,
  STREAM_FAILED: 1,
  RATE_LIMITED: 0,
  PROVIDER_AUTH: 3,
  PROVIDER_MODEL_UNKNOWN: 0,
  SCHEMA_INVALID: 0,
  HOST_NOT_PERMITTED: 0,
};

// ---------------------------------------------------------------------------
// D-13 privacy gate + D-18 jsonMode capability
// ---------------------------------------------------------------------------

/** The only local provider id (D-13): ollama. A D-12 custom endpoint keeps its 'openai' id. */
export function isLocalProvider(providerId: ProviderId): boolean {
  return providerId === 'ollama';
}

/**
 * D-13: a failing LOCAL provider never hops to a CLOUD provider under
 * 'prefer-local'. 'local-only' is reserved (never produced this phase) and
 * 'cloud-ok' permits the hop. Pure predicate — enforced during fallback-chain
 * traversal in createStageInvocation (NEVER a resolveTier filter).
 */
export function refusedByPrivacyGate(
  privacyMode: PrivacyMode,
  fromProvider: ProviderId,
  toProvider: ProviderId,
): boolean {
  if (privacyMode !== 'prefer-local') return false;
  return isLocalProvider(fromProvider) && !isLocalProvider(toProvider);
}

/** D-18: Ollama rides the OpenAI-compatible endpoint whose JSON support is
 *  model-dependent — default 'prompt' (schema embedded in [SYSTEM]); the cloud
 *  adapters advertise native JSON. */
export function jsonModeForProvider(providerId: ProviderId): JsonMode {
  return providerId === 'ollama' ? 'prompt' : 'native';
}

// ---------------------------------------------------------------------------
// F-5 messages[] builder (P-4)
// ---------------------------------------------------------------------------

export interface BuiltStageMessages {
  systemText: string;
  taskText: string;
  /** applyCacheHints providerOptions (anthropic cacheControl) when emitted and hints enabled. */
  providerOptions?: ProviderMetadata;
  /** The messages[] shape every constructed SDK call uses — NEVER `system: string`. */
  messages: CoreMessage[];
}

/**
 * F-5 (P-4): the messages[]+providerOptions shape every constructed
 * generateObject/generateText call uses (and the 03-06 renderer path feeds
 * StreamAdapter the same shape). The cached [SYSTEM] is a CoreSystemMessage
 * carrying providerOptions.anthropic.cacheControl sourced from applyCacheHints
 * (03-03 strategy owner) when the §19.13 cascade has not paused hints.
 */
export function buildStageMessages(
  providerId: ProviderId,
  sections: PromptSection[],
): BuiltStageMessages {
  const systemText = joinSections(sections, CACHED_KINDS);
  const taskText = joinSections(sections, TASK_KINDS);
  const cache = applyCacheHints(providerId, sections);
  const providerOptions = getPromptCacheManager().hintsEnabled()
    ? cache.providerOptions
    : undefined;
  return {
    systemText,
    taskText,
    providerOptions,
    messages: [
      { role: 'system', content: systemText, ...(providerOptions ? { providerOptions } : {}) },
      { role: 'user', content: taskText },
    ],
  };
}

// ---------------------------------------------------------------------------
// Typed ProviderUnavailableError (visible provider-failure state)
// ---------------------------------------------------------------------------

export type ProviderUnavailableReason =
  | 'provider_unconfigured' // D-07: no configured+enabled provider matches the tier
  | 'privacy_blocked' // D-13: prefer-local refuses a local→cloud hop
  | 'no_candidate' // chain exhausted (all attempted / breakers open / budget spent)
  | 'budget_blocked' // D-16: the budgetGuard hook refused the stage call
  | 'stream_frozen'; // §1.5: never switch provider after the first streamed token

/**
 * The typed "visible provider-failure" carrier the Router throws. `reason`
 * strings are terminal reasonCode markers (provider_unconfigured stays a typed
 * marker, NOT an error-code constant); the debugLog vocabulary remains the
 * canonical 13-code Phase-3 block (Golden Rule 9).
 */
export interface ProviderUnavailableError extends Error {
  code: 'PROVIDER_UNAVAILABLE';
  reason: ProviderUnavailableReason;
  providerId?: ProviderId;
  detail?: string;
}

/** Guard for the provider_unconfigured terminal state (D-07 gate). */
export function isProviderUnconfiguredError(
  err: unknown,
): err is ProviderUnavailableError & { reason: 'provider_unconfigured' } {
  return (
    err instanceof Error &&
    (err as ProviderUnavailableError).code === 'PROVIDER_UNAVAILABLE' &&
    (err as ProviderUnavailableError).reason === 'provider_unconfigured'
  );
}

function unavailable(
  reason: ProviderUnavailableReason,
  providerId?: ProviderId,
  detail?: string,
): ProviderUnavailableError {
  const err = new Error(
    `PROVIDER_UNAVAILABLE: ${reason}${detail ? ` (${detail})` : ''}`,
  ) as ProviderUnavailableError;
  err.code = 'PROVIDER_UNAVAILABLE';
  err.reason = reason;
  err.providerId = providerId;
  err.detail = detail;
  return err;
}

// ---------------------------------------------------------------------------
// D-16 budgetGuard hook
// ---------------------------------------------------------------------------

export interface BudgetGuardInput {
  operationId: string;
  providerId: ProviderId;
  model: string;
  estimatedTokens: number;
}

export interface BudgetGuardResult {
  allowed: boolean;
  reason?: string;
}

export type BudgetGuard = (input: BudgetGuardInput) => BudgetGuardResult;

/** D-16: the Phase-3 no-op — Phase 6 wires the monthly ledger pre-flight here. */
const DEFAULT_BUDGET_GUARD: BudgetGuard = () => ({ allowed: true });

const DEFAULT_SDK_CONFIG: () => GetAISDKModelConfig = () => ({});

// ---------------------------------------------------------------------------
// ProviderRouter
// ---------------------------------------------------------------------------

export class ProviderRouter {
  private readonly operations = new Map<string, RouterAttemptState>();
  /** Source of truth for the breaker — providerId → reopen epoch ms. */
  private readonly breakerOpenUntil = new Map<ProviderId, number>();
  /** Per-provider failure votes within the §1.5 window (consecutive: cleared on success). */
  private readonly failureVotes = new Map<ProviderId, Array<{ at: number; votes: number }>>();
  private readonly now: () => number;

  /** D-16: the cost pre-flight hook — pass-through this phase. */
  budgetGuard: BudgetGuard = DEFAULT_BUDGET_GUARD;
  /** 03-09 wiring baseline: the surface's configured providers (registry → TierResolveInput shape). */
  private configuredProviders: TierResolveInput['configuredProviders'] = [];
  /** 03-09 wiring baseline: the D-13 privacy mode derived from persona prefs. */
  private privacyMode: PrivacyMode = 'prefer-local';

  constructor(opts: { now?: () => number } = {}) {
    this.now = opts.now ?? Date.now;
  }

  /**
   * 03-09 wiring: establish the per-surface baseline BEFORE any send —
   * budgetGuard (D-16, Phase 6 ledger), configuredProviders, and the D-13
   * privacyMode (privacyModeFromPrefs: false → 'prefer-local', true →
   * 'cloud-ok'). createStageInvocation falls back to these when a caller
   * omits the per-call values (the hook 03-08 still passes them explicitly).
   */
  configure(opts: {
    budgetGuard?: BudgetGuard;
    configuredProviders?: TierResolveInput['configuredProviders'];
    privacyMode?: PrivacyMode;
  }): void {
    if (opts.budgetGuard) this.budgetGuard = opts.budgetGuard;
    if (opts.configuredProviders) this.configuredProviders = opts.configuredProviders;
    if (opts.privacyMode) this.privacyMode = opts.privacyMode;
  }

  /**
   * The Seam-2 seam: resolve the cheapest-capable candidate (resolveTier +
   * getAISDKModel), advance past already-failed providers / open breakers,
   * enforce the D-13 privacy gate during fallback traversal, and build the
   * F-4 callProviderJsonMode closure over the F-5 messages[] call shape.
   * Returns the (providerId, model, jsonMode, callProviderJsonMode) bundle —
   * the hook/orchestrator (03-06/03-08) consume it.
   */
  createStageInvocation(input: CreateStageInvocationInput): StageInvocation {
    const state = this.operationState(input.operationId);
    if (state.hasStreamedFirstToken) {
      // §1.5: never switch after the first token — enforced inside the
      // renderer-stage invocation path (mid-stream provider freeze).
      throw unavailable(
        'stream_frozen',
        undefined,
        'provider frozen after the first streamed token',
      );
    }
    if (this.retryCount(input.operationId) >= ROUTER_MAX_ATTEMPTS) {
      // R-2 (CR-01): the router-owned RETRY budget is spent — terminate, never
      // re-enter. Legitimate sequential stage calls (planner loop iterations,
      // the renderer resolution) NEVER consume this budget.
      throw unavailable('no_candidate', undefined, 'router attempt budget exhausted');
    }
    // 03-09 wiring baseline fallback: per-call values win; configure()'d
    // baseline (surface providers + D-13 privacy mode) applies when omitted.
    const configuredProviders = input.configuredProviders ?? this.configuredProviders;
    const privacyMode = input.privacyMode ?? this.privacyMode;
    const resolved = resolveTier({
      tier: input.tier,
      configuredProviders,
      privacyMode,
    });
    if (!resolved) {
      // D-07: no configured+enabled provider matches the tier → unconfigured.
      // WR-01 (04): GR-9 — this terminal had zero observability end-to-end
      // (the privacy_blocked site below logs; this one did not). Canonical
      // UNKNOWN code (provider_unconfigured is a typed reason marker, NOT an
      // error-code constant) + module + operationId only — no provider text.
      debugLog(ERROR_CODES.UNKNOWN, 'provider_unconfigured — no provider matches the tier', {
        module: 'ProviderRouter',
        extra: { operationId: input.operationId },
      });
      throw unavailable('provider_unconfigured');
    }
    const chain: Array<{ providerId: ProviderId; model: string }> = [
      { providerId: resolved.providerId, model: resolved.model },
      ...resolved.fallbackChain,
    ];
    const failed = new Set(
      state.attempts.filter((a) => a.outcome === 'failed').map((a) => a.providerId),
    );
    const lastFailed = [...state.attempts].reverse().find((a) => a.outcome === 'failed');

    for (const cand of chain) {
      if (failed.has(cand.providerId)) continue; // already failed this operation — advance
      if (this.isBreakerOpen(cand.providerId)) continue; // §1.5 breaker — observability via accessors
      if (lastFailed && refusedByPrivacyGate(privacyMode, lastFailed.providerId, cand.providerId)) {
        // D-13: prefer-local + dead local → terminate in a visible provider-failure
        // state; the refusal is debugLogged (R-10 redacted via debugLog).
        debugLog(
          ERROR_CODES.HOST_NOT_PERMITTED,
          'cloud fallback refused — prefer-local privacy mode',
          {
            module: 'ProviderRouter',
            extra: {
              operationId: input.operationId,
              fromProvider: lastFailed.providerId,
              toProvider: cand.providerId,
              privacyMode,
            },
          },
        );
        throw unavailable(
          'privacy_blocked',
          lastFailed.providerId,
          `prefer-local refuses ${cand.providerId} after ${lastFailed.providerId} failed`,
        );
      }
      if (lastFailed && lastFailed.providerId !== cand.providerId) {
        // Legitimate fallback hop (cloud-ok, or cloud→cloud / cloud→local):
        // logged with the triggering failure's canonical code (Golden Rule 9).
        debugLog(
          lastFailed.errorCode ?? ERROR_CODES.UNKNOWN,
          `fallback hop ${lastFailed.providerId} → ${cand.providerId}`,
          {
            module: 'ProviderRouter',
            error: undefined,
            extra: {
              operationId: input.operationId,
              fromProvider: lastFailed.providerId,
              toProvider: cand.providerId,
            },
          },
        );
      }
      return this.buildInvocation(input, cand);
    }
    throw unavailable('no_candidate');
  }

  /** D-14: per-operation attempt ledger (undefined before the first resolution). */
  getAttemptState(operationId: string): RouterAttemptState | undefined {
    return this.operations.get(operationId);
  }

  /**
   * §1.5: the renderer-stage invocation path calls this after the first
   * streamed chunk — from then on createStageInvocation refuses to switch
   * providers (mid-stream freeze).
   */
  markStreamedFirstToken(operationId: string): void {
    this.operationState(operationId).hasStreamedFirstToken = true;
  }

  /**
   * D-17: classify an SDK/provider error into a canonical C.2 code + retryable
   * flag. Retryable pre-first-token codes: TIMEOUT, PROVIDER_5XX, NETWORK,
   * RATE_LIMITED. Non-retryable: PROVIDER_AUTH, PROVIDER_MODEL_UNKNOWN,
   * SCHEMA_INVALID, HOST_NOT_PERMITTED. Aborts are never provider failures.
   *
   * WR-03 (03-11): the typed TimeoutError carrier (thrown by
   * StructuredOutput.attempt for timeout-origin aborts) is checked FIRST —
   * before the isAbortError branch — mapping timeout-origin failures to
   * TIMEOUT/retryable. Genuine user cancels (AbortError, no carrier) still
   * land on UNKNOWN and are never retried (T-03-11-01/02).
   */
  classifyProviderError(err: unknown): ClassifiedProviderError {
    if (isTimeoutError(err)) {
      // WR-03: timeout-origin failure — retryable (TIMEOUT ∈ RETRYABLE_CODES),
      // and BREAKER_VOTES.TIMEOUT = 1 keeps the §1.5 breaker honest.
      return { code: 'TIMEOUT', retryable: true };
    }
    if (NoObjectGeneratedError.isInstance(err)) {
      // Native path: the model output failed the schema at the SDK boundary.
      return { code: 'SCHEMA_INVALID', retryable: false };
    }
    if (err instanceof LoadAPIKeyError) {
      return { code: 'PROVIDER_AUTH', retryable: false };
    }
    if (isAbortError(err)) {
      // User/surface abort — not a provider failure, never retried, no breaker vote.
      return { code: 'UNKNOWN', retryable: false };
    }
    if (err instanceof APICallError) {
      const status = err.statusCode ?? 0;
      if (status >= 500) return { code: 'PROVIDER_5XX', retryable: true };
      if (status === 401 || status === 403) return { code: 'PROVIDER_AUTH', retryable: false };
      if (status === 404) return { code: 'PROVIDER_MODEL_UNKNOWN', retryable: false };
      if (status === 429) return { code: 'RATE_LIMITED', retryable: true };
      if (status === 400 || status === 422) return { code: 'SCHEMA_INVALID', retryable: false };
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (
      /fetch failed|ECONNREFUSED|ENOTFOUND|Failed to fetch|network error|NetworkError/i.test(msg)
    ) {
      return { code: 'NETWORK', retryable: true };
    }
    if (/timeout|timed out|deadline exceeded/i.test(msg)) {
      return { code: 'TIMEOUT', retryable: true };
    }
    return { code: 'UNKNOWN', retryable: false };
  }

  /**
   * Public breaker entry for the streaming path (03-06): a mid-stream/stream
   * failure votes the provider's breaker. The json-mode closure votes internally.
   */
  recordFailure(providerId: ProviderId, code: ErrorCode, err?: unknown): void {
    this.voteBreaker(providerId, code, err);
  }

  /** §1.5: true while the provider is in the 5-minute open window. */
  isBreakerOpen(providerId: ProviderId): boolean {
    return this.now() < (this.breakerOpenUntil.get(providerId) ?? 0);
  }

  /** Observable breaker state (AI-SPEC §7 sampling): ms until reopen (0 = closed). */
  breakerRemainingMs(providerId: ProviderId): number {
    return Math.max(0, (this.breakerOpenUntil.get(providerId) ?? 0) - this.now());
  }

  // --- internals ----------------------------------------------------------

  private buildInvocation(
    input: CreateStageInvocationInput,
    cand: { providerId: ProviderId; model: string },
  ): StageInvocation {
    const providerId = cand.providerId;
    const jsonMode = jsonModeForProvider(providerId);
    const model = (input.getModel ?? getAISDKModel)(
      providerId,
      cand.model,
      (input.getSDKConfig ?? DEFAULT_SDK_CONFIG)(providerId),
    );
    return {
      providerId,
      model,
      jsonMode,
      // 04-05 (D-04-04/06): the resolved candidate's window from the canonical
      // map — synchronous + pure (zero model calls); the hook reads it from the
      // StageInvocation for per-stage optimization. Unknown models resolve
      // conservatively (4096, windowKnown:false — never assume large, T-04-21).
      modelContextWindow: resolveModelContextWindow(cand.model).contextWindow,
      callProviderJsonMode: this.buildCallProviderJsonMode(input, cand, model, jsonMode),
    };
  }

  /**
   * F-4 (D-18): the sections-in closure. Resolves jsonMode per provider
   * (ollama → 'prompt', others → 'native'); maps cached kinds → `system` and
   * task kinds → `prompt` via the pure joinSections helper (NO prompt.split);
   * F-5 call shape via buildStageMessages. Wraps the invocation with the D-17
   * retry policy: exactly ONE router retry per retryable pre-first-token code,
   * never a nested loop (R-2), never beyond the attempt budget.
   *
   * WR-03A (03-16): timeout-origin aborts are recovered from the incoming
   * signal's reason inside the closure (the SDK drops the reason and rejects a
   * bare AbortError); each attempt derives its own controller so the retried
   * call runs on a fresh non-aborted signal — never the aborted one.
   */
  private buildCallProviderJsonMode(
    input: CreateStageInvocationInput,
    cand: { providerId: ProviderId; model: string },
    model: LanguageModel,
    jsonMode: JsonMode,
  ): CallProviderJsonMode {
    let retried = false;
    return async (sections: PromptSection[], jsonSchema: unknown, signal: AbortSignal) => {
      // D-16: budget pre-flight — Phase 6 wires the monthly ledger here.
      const guard = this.budgetGuard({
        operationId: input.operationId,
        providerId: cand.providerId,
        model: cand.model,
        estimatedTokens: sections.reduce((n, s) => n + s.tokens, 0),
      });
      if (!guard.allowed) {
        throw unavailable(
          'budget_blocked',
          cand.providerId,
          guard.reason ?? 'budget guard refused',
        );
      }
      // CR-01: the inner attempt takes `isRetry` — the FIRST call per
      // stage/repair passes false (never consumes the R-2 budget); only the
      // D-17 retried call (below, L616-619) passes true.
      const attempt = async (isRetry: boolean): Promise<string> => {
        if (this.retryCount(input.operationId) >= ROUTER_MAX_ATTEMPTS) {
          throw unavailable('no_candidate', cand.providerId, 'router attempt budget exhausted');
        }
        // WR-03A: each attempt derives its OWN controller, re-parented to the
        // incoming signal — the D-17 retry runs on a FRESH non-aborted derived
        // signal (the parent is already aborted at retry time, so its 'abort'
        // event never re-fires — a retry on the same aborted signal would be
        // futile by construction). The listener is cleaned up in the finally.
        const derived = new AbortController();
        const onParentAbort = () => derived.abort(signal.reason);
        signal.addEventListener('abort', onParentAbort);
        // CR-01 (04): the RETRIED call must be bounded by ITS OWN timer — the
        // first attempt is already timed by StructuredOutput's per-attempt
        // one-shot setTimeout (T-03-04-04), so arming a second timer on it
        // would race the parent's ctx.timeoutMs. The retried call (isRetry)
        // has NO timer of its own (StructuredOutput's is consumed / shared
        // with the parent), so arm one on `derived`: a hung provider on the
        // retry terminates in RETRY_TIMEOUT_MS with the carrier as the abort
        // reason, never an untimed orphaned request that bills when it lands
        // (§17.5). Cleared in the finally.
        const retryTimer = isRetry
          ? setTimeout(() => derived.abort(timeoutError(RETRY_TIMEOUT_MS)), RETRY_TIMEOUT_MS)
          : undefined;
        try {
          const out = await this.invokeJsonMode(
            cand.providerId,
            model,
            jsonMode,
            input.maxTokens,
            sections,
            jsonSchema,
            derived.signal,
          );
          this.recordAttempt(
            input.operationId,
            cand.providerId,
            cand.model,
            'success',
            undefined,
            isRetry,
          );
          return out;
        } catch (e) {
          // WR-03A: the SDK drops the abort reason and rejects with a bare
          // AbortError — the timeout-origin carrier must be recovered from the
          // incoming signal's reason. Environment-independent SINGLE guard (no
          // instanceof conjunct on the rejection object: in production Chrome
          // the abort-origin rejection is a DOMException, NOT instanceof Error,
          // which would silently dead-end the recovery in production while
          // passing in jsdom — the exact test-realm-only failure WR-03A closes).
          // signal.reason is ONLY ever the carrier from StructuredOutput's own
          // timeout abort, or a user-abort reason (name 'AbortError' —
          // isTimeoutError false), so the single guard is sufficient.
          // CR-01 (04): the derived controller's OWN reason is ALSO checked —
          // the retry's per-attempt timer (RETRY_TIMEOUT_MS) aborts `derived`
          // with the carrier, and the SDK drops it the same way; without this
          // conjunct a retry-timeout would misclassify as UNKNOWN.
          if (isTimeoutError(signal.reason) || isTimeoutError(derived.signal.reason)) {
            const carrier = isTimeoutError(signal.reason) ? signal.reason : derived.signal.reason;
            // Ledger-correctness: record + vote BEFORE the rethrow — throwing
            // first bypasses this catch's recordAttempt entirely, so the failed
            // attempt would be missing from the ledger and the retry's success
            // would land as attempts[0] with errorCode undefined.
            this.recordAttempt(
              input.operationId,
              cand.providerId,
              cand.model,
              'failed',
              'TIMEOUT',
              isRetry,
            );
            this.voteBreaker(cand.providerId, 'TIMEOUT', carrier);
            throw carrier;
          }
          const cls = this.classifyProviderError(e);
          this.recordAttempt(
            input.operationId,
            cand.providerId,
            cand.model,
            'failed',
            cls.code,
            isRetry,
          );
          this.voteBreaker(cand.providerId, cls.code, e);
          throw e;
        } finally {
          signal.removeEventListener('abort', onParentAbort);
          if (retryTimer !== undefined) clearTimeout(retryTimer);
        }
      };
      try {
        return await attempt(false);
      } catch (e) {
        const cls = this.classifyProviderError(e);
        // D-17: exactly ONE router retry per retryable pre-first-token code;
        // non-retryable (PROVIDER_AUTH/MODEL_UNKNOWN/SCHEMA_INVALID/
        // HOST_NOT_PERMITTED) never retry (R-2 — never a nested loop). The
        // retried call is the ONLY one that increments retryCount (CR-01).
        if (cls.retryable && !retried) {
          // CR-01 (04): never retry on a dead parent signal — a TIMEOUT-origin
          // failure has already consumed StructuredOutput's one-shot timer and
          // aborted the parent, so re-parenting is dead code and the retried
          // call would be untimed AND un-cancellable (an orphaned paid request
          // that bills when it lands, §17.5). The guard makes the timeout
          // failure an honest bounded terminal (the carrier propagates to the
          // planner_failed fallback); NETWORK/5XX parents are alive, so those
          // retries still run — now bounded by the per-attempt retry timer.
          if (signal.aborted) throw e;
          retried = true;
          return await attempt(true);
        }
        throw e;
      }
    };
  }

  /**
   * F-4/F-5 core: build the messages[] shape and run generateObject (native)
   * or generateText (prompt). maxRetries: 0 (Pitfall 1 — the Router owns
   * retries) and an explicit maxTokens on EVERY constructed call.
   */
  private async invokeJsonMode(
    providerId: ProviderId,
    model: LanguageModel,
    jsonMode: JsonMode,
    maxTokens: number,
    sections: PromptSection[],
    jsonSchemaParam: unknown,
    signal: AbortSignal,
  ): Promise<string> {
    const { systemText, taskText, messages } = buildStageMessages(providerId, sections);
    if (jsonMode === 'native') {
      // D-18 native (openai/anthropic/gemini): the SDK validates against the
      // schema internally. The closure receives the JSON schema at call time
      // (F-4 signature), so the ai jsonSchema() Schema wrapper is used — no
      // build-time Zod dependency.
      const { object } = await generateObject({
        model,
        schema: jsonSchema(jsonSchemaParam as Parameters<typeof jsonSchema>[0]),
        mode: 'auto',
        messages,
        maxTokens,
        maxRetries: 0, // Pitfall 1 — the Router owns retries (D-17)
        abortSignal: signal,
      });
      return JSON.stringify(object);
    }
    // 'prompt' (ollama default, D-18): the schema is embedded in [SYSTEM] and
    // raw text comes back — Appendix L does the coercion + exactly ONE repair.
    const { text } = await generateText({
      model,
      messages: [
        {
          role: 'system',
          content: `${systemText}\nReturn JSON only, matching this schema exactly:\n${JSON.stringify(jsonSchemaParam)}`,
        },
        { role: 'user', content: taskText },
      ],
      maxTokens,
      maxRetries: 0,
      abortSignal: signal,
    });
    return text;
  }

  private operationState(operationId: string): RouterAttemptState {
    let state = this.operations.get(operationId);
    if (!state) {
      state = {
        operationId,
        attempts: [],
        retryCount: 0,
        hasStreamedFirstToken: false,
        circuitBreakerOpen: {},
      };
      this.operations.set(operationId, state);
    }
    // Keep the snapshot's breaker map current — the class map is the source of truth.
    state.circuitBreakerOpen = Object.fromEntries(
      [...this.breakerOpenUntil.entries()].map(([id, until]) => [id, until]),
    ) as Partial<Record<ProviderId, number>>;
    return state;
  }

  /** CR-01: the R-2 router-owned retry budget (only D-17 retried calls count). */
  private retryCount(operationId: string): number {
    return this.operationState(operationId).retryCount;
  }

  private recordAttempt(
    operationId: string,
    providerId: ProviderId,
    model: string,
    outcome: ProviderAttempt['outcome'],
    errorCode?: ErrorCode,
    isRetry = false,
  ): void {
    const state = this.operationState(operationId);
    state.attempts.push({ providerId, model, at: this.now(), outcome, errorCode });
    // CR-01: only the D-17 router-owned retried call consumes the R-2 budget.
    if (isRetry) state.retryCount += 1;
    // Consecutive-failure semantics (§1.5): a success clears the provider's votes.
    if (outcome === 'success') this.failureVotes.delete(providerId);
  }

  /**
   * §20.10: vote the provider's breaker. 3 votes within 60 s → open for
   * 5 minutes. RATE_LIMITED/MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED
   * vote 0; PROVIDER_AUTH votes 3 (opens immediately). The OPEN transition is
   * debugLogged with the tipping failure's canonical code (AI-SPEC §7).
   */
  private voteBreaker(providerId: ProviderId, code: ErrorCode, err?: unknown): void {
    const votes = BREAKER_VOTES[code] ?? 0;
    if (votes <= 0) return;
    const windowStart = this.now() - BREAKER_WINDOW_MS;
    const window = (this.failureVotes.get(providerId) ?? []).filter((v) => v.at >= windowStart);
    window.push({ at: this.now(), votes });
    const total = window.reduce((n, v) => n + v.votes, 0);
    if (total >= BREAKER_FAILURE_THRESHOLD) {
      this.breakerOpenUntil.set(providerId, this.now() + BREAKER_OPEN_MS);
      this.failureVotes.delete(providerId);
      // R-10: the tipping error message (if any) routes through TraceRedactor.
      debugLog(code, 'circuit breaker OPEN — provider marked unavailable for 5 minutes', {
        module: 'ProviderRouter',
        error: err instanceof Error ? err : undefined,
        extra: { providerId },
      });
      return;
    }
    this.failureVotes.set(providerId, window);
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

let singleton: ProviderRouter | null = null;

/**
 * Lazy singleton (ProviderRegistry/PromptCacheManager precedent). The
 * orchestrator (03-08) and the renderer-stage path (03-06) read the Router via
 * the singleton — they never construct their own.
 */
export function getProviderRouter(): ProviderRouter {
  if (singleton === null) singleton = new ProviderRouter();
  return singleton;
}
