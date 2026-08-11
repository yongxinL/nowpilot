// tests/core/ai/AgentOrchestrator.budget.test.ts — CR-01 permanent regression
// (03-10). Reproduces VERIFICATION.md gap CR-01 EXACTLY: a legitimate
// medium-tier turn (caps 3/2) that uses the ALLOWED 2 tool calls must complete
// with an answer — pre-fix, ROUTER_MAX_ATTEMPTS=3 counted every SDK call
// (planner loop + renderer resolution) and the renderer stage threw
// `PROVIDER_UNAVAILABLE: no_candidate (router attempt budget exhausted)` even
// though every provider call succeeded.
//
// This suite deliberately does NOT mock the Router, resolveTier, PlannerService,
// ExecutorService, or RendererService: a REAL ProviderRouter with the default
// budget, REAL TierResolver (configuredProviders resolves openai/deepseek-chat
// for both haiku and flash), REAL PlannerService requestJson path (the Zod
// PlannerDecisionSchema), REAL ExecutorService closed-enum gate, and REAL
// RendererService run the FULL planner-loop → renderer-resolution interplay
// against the real retry budget. Only the three ai-sdk call sites
// (generateObject / generateText / streamText) are stubbed — with the real
// error classes kept (importOriginal) so classifyProviderError's instanceof
// checks remain meaningful (the ProviderRouter.test.ts L46-53 pattern).
//
// This file REPLACES the throwaway tests/core/ai/zz-verify-cr01.test.ts
// (housekeeping: absent from the repo).
import { APICallError, generateObject, generateText, streamText } from 'ai';
import type { LanguageModel } from 'ai';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { capsForTier, runAgentTurn } from '@/core/ai/AgentOrchestrator';
import type { AgentTurnInput, StageResolver } from '@/core/ai/AgentOrchestrator';
import { ProviderRouter } from '@/core/ai/ProviderRouter';
import type { CreateStageInvocationInput } from '@/core/ai/ProviderRouter';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

// ---------------------------------------------------------------------------
// 'ai' module mock: keep the real error classes (instanceof checks in
// classifyProviderError must work) but stub the three SDK call sites.
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
const generateTextMock = vi.mocked(generateText);
const streamTextMock = vi.mocked(streamText);

type GenObjectResult = Awaited<ReturnType<typeof generateObject>>;

/** The 03-08 hook's StageResolver shape (useStreamingLLM.ts L144-151) over a REAL router. */
const fakeModel = {
  id: 'deepseek-chat',
  modelId: 'deepseek-chat',
  vendor: 'fixture',
} as unknown as LanguageModel;

const OPERATION_ID = 'op-budget-regression';

function makeResolver(
  router: ProviderRouter,
  providers: CreateStageInvocationInput['configuredProviders'] = [
    { id: 'openai', models: ['deepseek-chat'], enabled: true, priority: 1 },
  ],
): StageResolver {
  return (stage) =>
    router.createStageInvocation({
      operationId: OPERATION_ID,
      tier: stage === 'planner' ? 'haiku' : 'flash',
      privacyMode: 'prefer-local',
      maxTokens: stage === 'planner' ? 256 : 512,
      configuredProviders: providers,
      getModel: () => fakeModel,
    });
}

function makeTurnInput(
  router: ProviderRouter,
  overrides: Partial<AgentTurnInput> = {},
): AgentTurnInput {
  return {
    operationId: OPERATION_ID,
    userInput: 'Summarize the current page.',
    context: buildOptimizedContextFixture(),
    abortSignal: new AbortController().signal,
    tier: capsForTier('medium'),
    invocation: makeResolver(router),
    ...overrides,
  };
}

function apiError(statusCode: number): APICallError {
  return new APICallError({
    message: 'provider rejected the request',
    url: 'https://fixture.example/v1/chat/completions',
    requestBodyValues: {},
    statusCode,
  });
}

function mockStreamedAnswer(text: string): void {
  streamTextMock.mockReturnValue({
    textStream: (async function* () {
      yield text;
    })(),
    finishReason: Promise.resolve('stop'),
  } as unknown as ReturnType<typeof streamText>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CR-01 regression — the R-2 budget never starves legitimate stage calls', () => {
  it('a medium-tier 2-tool turn completes with an answer — the renderer runs, never no_candidate', async () => {
    const router = new ProviderRouter();
    // Real resolveTier resolves openai/deepseek-chat for both haiku + flash.
    generateObjectMock
      .mockResolvedValueOnce({
        object: { action: 'run_tool', toolName: 'get-provider-info', input: {} },
      } as unknown as GenObjectResult)
      .mockResolvedValueOnce({
        object: { action: 'run_tool', toolName: 'get-provider-info', input: {} },
      } as unknown as GenObjectResult)
      .mockResolvedValueOnce({
        object: { action: 'answer', reasonCode: 'success' },
      } as unknown as GenObjectResult);
    mockStreamedAnswer('final answer');

    // Pre-fix this rejects with PROVIDER_UNAVAILABLE: no_candidate (router
    // attempt budget exhausted) at the renderer resolution after 3
    // planner-loop attempts. Post-fix the turn resolves 'completed' (CR-01).
    await expect(runAgentTurn(makeTurnInput(router))).resolves.toMatchObject({
      status: 'completed',
    });
    expect(streamTextMock).toHaveBeenCalledTimes(1); // the renderer stage actually ran
    expect(generateObjectMock).toHaveBeenCalledTimes(3); // 2 run_tool plans + 1 answer plan
    expect(generateTextMock).not.toHaveBeenCalled(); // native jsonMode only
    expect(router.getAttemptState(OPERATION_ID)?.retryCount).toBe(0); // no router retries consumed
  });

  it('a 1-tool turn whose first planner call needs a structured-output repair still completes', async () => {
    const router = new ProviderRouter();
    // attempt #1 emits a decision that FAILS the PlannerDecisionSchema
    // ({ action: 'bogus' } is outside the closed discriminated union) →
    // requestJson repairs EXACTLY ONCE; the repair emits a valid run_tool;
    // the third call answers. A repair is a legitimate second stage call —
    // it must NEVER consume the router-owned retry budget.
    generateObjectMock
      .mockResolvedValueOnce({ object: { action: 'bogus' } } as unknown as GenObjectResult)
      .mockResolvedValueOnce({
        object: { action: 'run_tool', toolName: 'get-provider-info', input: {} },
      } as unknown as GenObjectResult)
      .mockResolvedValueOnce({
        object: { action: 'answer', reasonCode: 'success' },
      } as unknown as GenObjectResult);
    mockStreamedAnswer('final answer');

    // Pre-fix: the repair's extra attempt (2 on one planner call) + the second
    // planner call = 3 total, so the renderer resolution was blocked with
    // no_candidate. Post-fix the turn completes with an answer (status 'completed').
    await expect(runAgentTurn(makeTurnInput(router))).resolves.toMatchObject({
      status: 'completed',
    });
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(router.getAttemptState(OPERATION_ID)?.retryCount).toBe(0); // a repair is NOT a retry
  });

  it('a D-17 retried planner call consumes the retry budget but the turn still answers', async () => {
    const router = new ProviderRouter();
    // planner call #1: retryable PROVIDER_5XX → the D-17 router retry resolves a
    // valid run_tool; the third call answers. The retried call is the ONLY
    // budget consumer (retryCount=1), and the renderer still runs.
    //
    // The resolver carries a SECOND provider (anthropic): the D-17 retry leaves
    // a `failed` ledger entry for openai, and the unchanged fallback-chain
    // failed-provider skip advances the next planner stage to anthropic — so
    // the turn completes and the BUDGET gate is what pre-fix blocked (not
    // chain exhaustion).
    generateObjectMock
      .mockRejectedValueOnce(apiError(500))
      .mockResolvedValueOnce({
        object: { action: 'run_tool', toolName: 'get-provider-info', input: {} },
      } as unknown as GenObjectResult)
      .mockResolvedValueOnce({
        object: { action: 'answer', reasonCode: 'success' },
      } as unknown as GenObjectResult);
    mockStreamedAnswer('final answer');

    const twoProviderResolver = makeResolver(router, [
      { id: 'openai', models: ['deepseek-chat'], enabled: true, priority: 1 },
      { id: 'anthropic', models: ['claude-haiku-4-latest'], enabled: true, priority: 2 },
    ]);

    // Pre-fix: 2 attempts on one planner call + the 2nd planner call = 3 →
    // the renderer resolution was blocked with the budget no_candidate.
    // Post-fix the retry consumes retryCount=1 (well under the 3-cap) and the
    // turn completes with an answer (status 'completed').
    await expect(
      runAgentTurn(makeTurnInput(router, { invocation: twoProviderResolver })),
    ).resolves.toMatchObject({ status: 'completed' });
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(generateObjectMock).toHaveBeenCalledTimes(3); // fail + retry + answer
    expect(router.getAttemptState(OPERATION_ID)?.retryCount).toBe(1); // exactly the D-17 retry
  });
});
