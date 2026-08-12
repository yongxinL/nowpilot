// tests/core/ai/StructuredOutput.timeoutRetry.test.ts — WR-03A permanent
// END-TO-END regression (03-16) + CR-01 re-scope (04). Reproduces
// VERIFICATION.md gap 3 / WR-03A EXACTLY: the empirical probe ran REAL
// requestJson + REAL Router closure with a 25 ms timeout and observed
// generateObject 1×, retryCount 0, ledger 'UNKNOWN' — the D-17 retry never
// fired on the production timeout path (pre-fix, the per-attempt abort produced
// a bare AbortError inside the router closure, classified UNKNOWN before the
// TimeoutError carrier was born).
//
// This file pins the post-WR-03A contract through the FULL production path: a
// 25 ms timeout aborts the per-attempt signal WITH the typed carrier as its
// reason → the closure recovers the carrier from signal.reason (the SDK drops
// the reason and rejects a bare AbortError) → TIMEOUT recorded in the ledger
// → the CR-01 dead-signal guard (the parent's abort event already fired — the
// timeout origin leaves NO live parent to re-parent to) makes the failure an
// HONEST BOUNDED TERMINAL: exactly ONE SDK call, retryCount 0, and the
// TimeoutError carrier propagates to the caller (planOnce converts it to the
// deterministic planner_failed fallback — never a silent idle, never an
// untimed/un-cancellable orphaned retry, §17.5).
//
// Only the ai-sdk call sites are stubbed (real error classes kept via the
// importOriginal spread) — NEVER a mocked callProviderJsonMode, NEVER a mocked
// Router: the REAL resolveTier + REAL closure run (AgentOrchestrator.budget
// .test.ts precedent). A regression to the pre-fix behavior (retry firing on a
// dead signal, or 1 call with ledger UNKNOWN) fails this suite immediately.
import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { requestJson } from '@/core/ai/StructuredOutput';
import type { StructuredOutputContext } from '@/core/ai/StructuredOutput';
import { ProviderRouter } from '@/core/ai/ProviderRouter';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import { isTimeoutError } from '@/core/error/TimeoutError';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

// ---------------------------------------------------------------------------
// 'ai' module mock: keep the real exports (APICallError's instanceof checks in
// classifyProviderError must work), stub ONLY the SDK call sites
// (AgentOrchestrator.budget.test.ts precedent — L37-45).
// ---------------------------------------------------------------------------
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateObject: vi.fn(),
    generateText: vi.fn(),
    streamText: vi.fn(),
  };
});

const generateObjectMock = vi.mocked(generateObject);

type GenObjectResult = Awaited<ReturnType<typeof generateObject>>;

/** Budget-test precedent (L54-58): modelId set — inv.model.modelId feeds ctx.model. */
const fakeModel = {
  id: 'deepseek-chat',
  modelId: 'deepseek-chat',
  vendor: 'fixture',
} as unknown as LanguageModel;

/** The StructuredOutput.test.ts DecisionSchema shape (L24-28). */
const DecisionSchema = z.object({
  action: z.literal('answer'),
  reasonCode: z.string().max(64),
  confidence: z.number().min(0).max(1),
});

let opSeq = 0;

/**
 * REAL Router + REAL resolveTier + REAL closure: fresh router + unique
 * operationId per test so router operation state stays fully isolated.
 */
function buildRealInvocation(operationId: string): {
  router: ProviderRouter;
  inv: StageInvocation;
} {
  const router = new ProviderRouter();
  const inv = router.createStageInvocation({
    operationId,
    tier: 'haiku',
    privacyMode: 'prefer-local',
    maxTokens: 256,
    configuredProviders: [{ id: 'openai', models: ['deepseek-chat'], enabled: true, priority: 1 }],
    getModel: () => fakeModel,
  });
  return { router, inv };
}

function requestJsonContext(operationId: string, inv: StageInvocation): StructuredOutputContext {
  return {
    operationId,
    providerId: inv.providerId,
    model: inv.model.modelId,
    timeoutMs: 25,
    abortSignal: new AbortController().signal,
    callProviderJsonMode: inv.callProviderJsonMode,
  };
}

/**
 * The production arrival pattern for the SDK mock: registers an abort listener
 * on the abortSignal the SDK call receives and rejects with a BARE AbortError
 * (the SDK drops the abort reason) when it fires — with an immediate-reject
 * guard for determinism if the signal is already aborted.
 */
function abortSensitiveReject() {
  return (args: unknown) =>
    new Promise<GenObjectResult>((_resolve, reject) => {
      const sig = (args as { abortSignal: AbortSignal }).abortSignal;
      if (sig.aborted) {
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      sig.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
}

beforeEach(() => {
  vi.clearAllMocks();
  getPromptCacheManager().reset(); // hints enabled — buildStageMessages emits providerOptions
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CR-01 — a timeout-origin failure is a bounded terminal (no retry on a dead signal)', () => {
  it('a production timeout NEVER retries — 1 SDK call, retryCount 0, ledger TIMEOUT, the TimeoutError carrier propagates', async () => {
    const operationId = `op-timeout-retry-${(opSeq += 1)}`;
    const { router, inv } = buildRealInvocation(operationId);
    // The first SDK call is abort-sensitive and REJECTS on the timeout abort
    // (a bare AbortError — the SDK drops the carrier reason). With CR-01, the
    // dead-signal guard means the D-17 retry NEVER fires for a timeout origin,
    // so no success mock is ever consumed.
    generateObjectMock.mockImplementationOnce(abortSensitiveReject());

    let caught: unknown;
    try {
      await requestJson(
        DecisionSchema,
        buildOptimizedContextFixture().sections,
        requestJsonContext(operationId, inv),
      );
    } catch (e) {
      caught = e;
    }

    // The bounded terminal: the TimeoutError carrier surfaces (via the
    // closure's recovery rethrow OR StructuredOutput's timedOut rethrow — both
    // produce a TimeoutError, which planOnce converts to the deterministic
    // planner_failed fallback — never a silent idle, never a re-invocation,
    // R-2).
    expect(isTimeoutError(caught)).toBe(true);
    // CR-01: the dead parent signal excludes the retry — exactly ONE SDK call,
    // never 2+ (pre-04 the retry fired on the dead signal and was untimed +
    // un-cancellable, an orphaned paid request).
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(router.getAttemptState(operationId)?.retryCount).toBe(0);
    // The recovery-branch record still lands FIRST (the failed TIMEOUT attempt
    // is recorded before the rethrow).
    expect(router.getAttemptState(operationId)?.attempts[0]).toMatchObject({
      outcome: 'failed',
      errorCode: 'TIMEOUT',
    });
  });

  it('a timeout-origin failure surfaces the TimeoutError carrier — the planner_failed fallback source is intact', async () => {
    const operationId = `op-timeout-retry-${(opSeq += 1)}`;
    const { inv } = buildRealInvocation(operationId);
    generateObjectMock.mockImplementationOnce(abortSensitiveReject());

    let caught: unknown;
    try {
      await requestJson(
        DecisionSchema,
        buildOptimizedContextFixture().sections,
        requestJsonContext(operationId, inv),
      );
    } catch (e) {
      caught = e;
    }

    // The carrier surfaces — via the closure's recovery rethrow (the parent
    // signal is permanently aborted-with-carrier) OR via StructuredOutput's
    // timedOut rethrow; both produce a TimeoutError carrier, which is what
    // planOnce converts to the visible planner_failed answer (AgentOrchestrator
    // L188-201) — never a silent idle, never a re-invocation (R-2).
    expect(isTimeoutError(caught)).toBe(true);
    // The timeout is bounded — exactly ONE SDK call (CR-01 dead-signal guard).
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it('a healthy first call never retries — 1 SDK call, retryCount 0', async () => {
    const operationId = `op-timeout-retry-${(opSeq += 1)}`;
    const { router, inv } = buildRealInvocation(operationId);
    generateObjectMock.mockResolvedValueOnce({
      object: { action: 'answer', reasonCode: 'ok', confidence: 0.9 },
    } as unknown as GenObjectResult);

    const result = await requestJson(
      DecisionSchema,
      buildOptimizedContextFixture().sections,
      requestJsonContext(operationId, inv),
    );

    expect(result).toEqual({ action: 'answer', reasonCode: 'ok', confidence: 0.9 });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(router.getAttemptState(operationId)?.retryCount).toBe(0);
  });
});
