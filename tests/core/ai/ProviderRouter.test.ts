// tests/core/ai/ProviderRouter.test.ts — ProviderRouter contract (03-05).
// The AI-SPEC eval suite's centerpiece: cost discipline (maxRetries: 0 on every
// constructed SDK call — Pitfall 1; exactly ONE router retry per retryable
// pre-first-token code, D-17; the §1.5 circuit breaker 3 votes/60 s → open 5 min,
// D-14; the R-2 non-multiplying attempt budget), the D-13 privacy boundary
// (prefer-local: a dead local provider NEVER hops to cloud — no resolveTier
// filter, the gate lives in fallback-chain traversal), the F-4 sections-in
// closure (joinSections maps a multi-line cached section WHOLE to `system` —
// never a prompt.split), the F-5 messages[]+providerOptions.anthropic.cacheControl
// shape (NEVER system:string), and the R-10 TraceRedactor boundary on every
// router log path. resolveTier is mocked so the Router's own privacy/fallback
// logic is exercised in isolation (the plan's T-03-05-01 gate lives HERE).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { APICallError, generateObject, generateText } from 'ai';
import type { LanguageModel } from 'ai';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BREAKER_OPEN_MS,
  CACHED_KINDS,
  TASK_KINDS,
  ProviderRouter,
  getProviderRouter,
  isProviderUnconfiguredError,
  joinSections,
  jsonModeForProvider,
} from '@/core/ai/ProviderRouter';
import type {
  CreateStageInvocationInput,
  ProviderUnavailableError,
  StageInvocation,
} from '@/core/ai/ProviderRouter';
import type { TierResolveResult } from '@/core/ai/TierResolver';
import { resolveTier } from '@/core/ai/TierResolver';
import { getPromptCacheManager } from '@/core/ai/PromptCacheManager';
import { timeoutError } from '@/core/error/TimeoutError';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';
import type { PromptSection } from '@/core/ai/types';

// ---------------------------------------------------------------------------
// 'ai' module mock: keep the real error classes (instanceof checks in
// classifyProviderError must work) but stub the two SDK call sites.
// ---------------------------------------------------------------------------
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateObject: vi.fn(),
    generateText: vi.fn(),
  };
});

// resolveTier is mocked per-test so the Router's OWN fallback/privacy logic is
// exercised in isolation (the plan's T-03-05-01 gate lives in the Router, never
// a resolveTier filter). The real candidate table stays for shape reference.
vi.mock('@/core/ai/TierResolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/ai/TierResolver')>();
  return {
    ...actual,
    resolveTier: vi.fn(),
  };
});

const generateObjectMock = vi.mocked(generateObject);
const generateTextMock = vi.mocked(generateText);
const resolveTierMock = vi.mocked(resolveTier);

type GenObjectResult = Awaited<ReturnType<typeof generateObject>>;

const fakeModel = { id: 'fixture-model', vendor: 'fixture' } as unknown as LanguageModel;

function section(
  partial: Partial<PromptSection> & Pick<PromptSection, 'kind' | 'text'>,
): PromptSection {
  return {
    tokens: 10,
    stable: true,
    sourceId: 'system',
    ...partial,
  };
}

function makeInput(
  overrides: Partial<CreateStageInvocationInput> = {},
): CreateStageInvocationInput {
  return {
    operationId: 'op-test-0001',
    tier: 'haiku',
    privacyMode: 'prefer-local',
    maxTokens: 256,
    configuredProviders: [
      { id: 'anthropic', models: ['claude-haiku-4-latest'], enabled: true, priority: 1 },
      { id: 'openai', models: ['deepseek-chat'], enabled: true, priority: 2 },
      { id: 'ollama', models: ['llama3.2:3b'], enabled: true, priority: 3 },
    ],
    getModel: () => fakeModel,
    ...overrides,
  };
}

function apiError(statusCode: number, message = 'provider rejected the request'): APICallError {
  return new APICallError({
    message,
    url: 'https://fixture.example/v1/chat/completions',
    requestBodyValues: {},
    statusCode,
  });
}

function mockResolveTier(result: TierResolveResult | null): void {
  resolveTierMock.mockReturnValue(result);
}

const PRIVACY_CHAIN: TierResolveResult = {
  providerId: 'ollama',
  model: 'llama3.2:3b',
  fallbackChain: [{ providerId: 'openai', model: 'deepseek-chat' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  getPromptCacheManager().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('joinSections — F-4 whole-section mapping (no prompt.split)', () => {
  it('maps a multi-line cached section WHOLE to system (never split)', () => {
    const persona = section({
      kind: 'system',
      text: 'persona.name=Fixture\n\npersona.tone=professional-warm\npersona.brevity=balanced',
      tokens: 20,
    });
    expect(joinSections([persona], CACHED_KINDS)).toBe(
      'persona.name=Fixture\n\npersona.tone=professional-warm\npersona.brevity=balanced',
    );
  });

  it('joins multiple cached sections with a blank-line separator', () => {
    const a = section({ kind: 'system', text: 'sys-block' });
    const b = section({ kind: 'tool_schemas', text: '[tools]', sourceId: 'tool-schemas' });
    expect(joinSections([a, b], CACHED_KINDS)).toBe('sys-block\n\n[tools]');
  });

  it('maps task kinds to prompt and ignores cached kinds', () => {
    const cached = section({ kind: 'system', text: 'sys-block' });
    const task = section({ kind: 'task', text: 'task-block', stable: false, sourceId: 'task' });
    const input = section({
      kind: 'user_input',
      text: 'ask',
      stable: false,
      sourceId: 'user-input',
    });
    expect(joinSections([cached, task, input], TASK_KINDS)).toBe('task-block\n\nask');
  });

  it('is pure and deterministic (F-4 idempotency)', () => {
    const secs = [section({ kind: 'system', text: 'x' })];
    expect(joinSections(secs, CACHED_KINDS)).toBe(joinSections(secs, CACHED_KINDS));
  });
});

describe('createStageInvocation — healthy path (cost discipline)', () => {
  it('resolves the cheapest-capable candidate and returns the StageInvocation bundle', () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv: StageInvocation = router.createStageInvocation(makeInput());

    expect(inv.providerId).toBe('openai');
    expect(inv.model).toBe(fakeModel);
    expect(inv.jsonMode).toBe('native');
    expect(typeof inv.callProviderJsonMode).toBe('function');
    expect(inv.callProviderJsonMode.length).toBe(3); // (sections, jsonSchema, signal) — F-4
  });

  it('healthy turn = exactly ONE SDK call per stage (AI-SPEC cost dimension)', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock.mockResolvedValueOnce({
      object: { answer: '42' },
    } as unknown as GenObjectResult);

    const fixture = buildOptimizedContextFixture();
    const out = await inv.callProviderJsonMode(
      fixture.sections,
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(JSON.parse(out)).toEqual({ answer: '42' });
  });
});

describe('createStageInvocation — D-13 privacy gate during fallback traversal', () => {
  // chain: [ollama (local), openai (cloud)] — a dead local provider must never
  // hop to cloud under 'prefer-local' (T-03-05-01).
  function localThenCloudChain() {
    mockResolveTier(PRIVACY_CHAIN);
  }

  it('prefer-local: a dead local provider terminates in privacy_blocked — NO cloud fetch', async () => {
    localThenCloudChain();
    const router = new ProviderRouter();
    const input = makeInput({ privacyMode: 'prefer-local' });
    const inv = router.createStageInvocation(input);
    expect(inv.providerId).toBe('ollama');
    generateTextMock.mockRejectedValue(apiError(401)); // non-retryable — exactly one call

    await expect(
      inv.callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    // The cloud provider was never called (generateObject = native, never hit).
    expect(generateObjectMock).not.toHaveBeenCalled();
    expect(generateTextMock).toHaveBeenCalledTimes(1); // only the local ollama attempt

    // A re-resolution skips the dead local and refuses the cloud hop — the
    // D-13 gate fires during fallback-chain traversal (T-03-05-01).
    let second: unknown;
    try {
      router.createStageInvocation(makeInput({ privacyMode: 'prefer-local' }));
    } catch (e) {
      second = e;
    }
    expect((second as ProviderUnavailableError).reason).toBe('privacy_blocked');
  });

  it('cloud-ok: the hop is legitimate and proceeds to the cloud candidate', async () => {
    localThenCloudChain();
    const router = new ProviderRouter();
    const input = makeInput({ privacyMode: 'cloud-ok' });
    const inv = router.createStageInvocation(input);
    expect(inv.providerId).toBe('ollama');
    generateTextMock.mockRejectedValue(apiError(401)); // dead local (non-retryable)

    await expect(
      inv.callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    const second = router.createStageInvocation(input);
    expect(second.providerId).toBe('openai'); // legitimate fallback hop (cloud-ok)
    generateObjectMock.mockResolvedValueOnce({
      object: { answer: '42' },
    } as unknown as GenObjectResult);
    const out = await second.callProviderJsonMode(
      [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
      { type: 'object', properties: {} },
      new AbortController().signal,
    );
    expect(out).toBe('{"answer":"42"}');
  });
});

describe('ProviderRouter — circuit breaker (§1.5, D-14)', () => {
  it('3 failure-votes within 60 s open the provider for 5 minutes', () => {
    let t = 1_000_000;
    const router = new ProviderRouter({ now: () => t });
    expect(router.isBreakerOpen('openai')).toBe(false);

    router.recordFailure('openai', 'TIMEOUT');
    t += 1_000;
    router.recordFailure('openai', 'TIMEOUT');
    t += 1_000;
    router.recordFailure('openai', 'TIMEOUT');

    expect(router.isBreakerOpen('openai')).toBe(true);
    expect(router.breakerRemainingMs('openai')).toBe(BREAKER_OPEN_MS);
    // After 5 minutes the breaker closes.
    t += BREAKER_OPEN_MS + 1;
    expect(router.isBreakerOpen('openai')).toBe(false);
  });

  it('4 failure-votes without a success open the provider (votes accumulate in-window)', () => {
    const router = new ProviderRouter({ now: () => 1_000_000 });
    router.recordFailure('openai', 'TIMEOUT'); // 1
    router.recordFailure('openai', 'TIMEOUT'); // 2
    router.recordFailure('openai', 'NETWORK'); // 3 → open
    router.recordFailure('openai', 'NETWORK');
    expect(router.isBreakerOpen('openai')).toBe(true);
  });

  it('an open breaker is skipped in the fallback chain (no calls to a broken provider)', () => {
    mockResolveTier({
      providerId: 'openai',
      model: 'deepseek-chat',
      fallbackChain: [{ providerId: 'ollama', model: 'llama3.2:3b' }],
    });
    const router = new ProviderRouter({ now: () => 1_000_000 });
    router.recordFailure('openai', 'PROVIDER_5XX');
    router.recordFailure('openai', 'PROVIDER_5XX');
    router.recordFailure('openai', 'PROVIDER_5XX');
    expect(router.isBreakerOpen('openai')).toBe(true);

    const inv = router.createStageInvocation(makeInput());
    expect(inv.providerId).toBe('ollama'); // breaker skipped the open provider
  });
});

describe('ProviderRouter — retry + attempt budget (D-17 / R-2)', () => {
  it('constructs SDK calls with maxRetries: 0 and the explicit maxTokens (Pitfall 1)', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput({ maxTokens: 512 }));
    generateObjectMock.mockResolvedValueOnce({
      object: { ok: true },
    } as unknown as GenObjectResult);

    await inv.callProviderJsonMode(
      [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const args = generateObjectMock.mock.calls[0][0] as Record<string, unknown>;
    expect(args.maxRetries).toBe(0);
    expect(args.maxTokens).toBe(512);
  });

  it('retries EXACTLY once on a retryable pre-first-token code (5xx) then succeeds', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock
      .mockRejectedValueOnce(apiError(500))
      .mockResolvedValueOnce({ object: { answer: '42' } } as unknown as GenObjectResult);

    const out = await inv.callProviderJsonMode(
      [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    expect(generateObjectMock).toHaveBeenCalledTimes(2); // first + exactly one router retry
    expect(out).toBe('{"answer":"42"}');
  });

  it('retries EXACTLY once on a TimeoutError carrier (WR-03, D-17) then succeeds', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock
      .mockRejectedValueOnce(timeoutError(3_000))
      .mockResolvedValueOnce({ object: { answer: '42' } } as unknown as GenObjectResult);

    const out = await inv.callProviderJsonMode(
      [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    // WR-03: the typed TimeoutError maps to TIMEOUT/retryable → exactly ONE
    // D-17 router retry (2 SDK calls, never 3+ — T-03-11-02).
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(out).toBe('{"answer":"42"}');
    expect(router.getAttemptState('op-test-0001')?.attempts[0].errorCode).toBe('TIMEOUT');
  });

  it('never retries a non-retryable code (PROVIDER_AUTH) — 1 call, terminal failure', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock.mockRejectedValue(apiError(401));

    await expect(
      inv.callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it('terminates with no_candidate ONLY after 3 router-owned retries exhaust the R-2 budget (CR-01)', async () => {
    // CR-01: the R-2 budget counts ONLY D-17 router-owned retried calls —
    // never legitimate sequential stage calls or repairs. A 3-provider chain
    // (all native jsonMode — no ollama prompt-mode generateText path) keeps
    // each retry cycle on a fresh provider (the previous cycle's failed
    // ledger entry advances the fallback chain), so the BUDGET GATE — not
    // chain exhaustion — is what terminates the 4th stage resolution.
    mockResolveTier({
      providerId: 'openai',
      model: 'deepseek-chat',
      fallbackChain: [
        { providerId: 'anthropic', model: 'claude-haiku-4-latest' },
        { providerId: 'gemini', model: 'gemini-2.0-flash' },
      ],
    });
    const router = new ProviderRouter();
    // 3 retry cycles: each callProviderJsonMode = 1 retryable failure + the D-17 retry.
    for (let cycle = 0; cycle < 3; cycle++) {
      const inv = router.createStageInvocation(makeInput());
      generateObjectMock
        .mockRejectedValueOnce(apiError(500))
        .mockResolvedValueOnce({ object: { answer: '42' } } as unknown as GenObjectResult);
      const out = await inv.callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      );
      expect(out).toBe('{"answer":"42"}');
    }
    expect(router.getAttemptState('op-test-0001')?.retryCount).toBe(3);

    // The retry budget is spent: the next createStageInvocation for this
    // operation refuses at the R-2 gate — no_candidate with the budget detail.
    let caught: unknown;
    try {
      router.createStageInvocation(makeInput());
    } catch (e) {
      caught = e;
    }
    expect((caught as ProviderUnavailableError).reason).toBe('no_candidate');
    expect((caught as ProviderUnavailableError).detail).toBe('router attempt budget exhausted');
  });

  it('a legitimate FIRST call of a stage never consumes the R-2 retry budget (CR-01)', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock.mockResolvedValueOnce({
      object: { answer: '42' },
    } as unknown as GenObjectResult);

    await inv.callProviderJsonMode(
      [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    // A successful first call leaves the router-owned retry budget untouched.
    expect(router.getAttemptState('op-test-0001')?.retryCount).toBe(0);
  });
});

describe('ProviderRouter — classifyProviderError (D-17 canonical mapping)', () => {
  it('classifies the canonical retryable pre-first-token codes', () => {
    const router = new ProviderRouter();
    expect(router.classifyProviderError(apiError(500))).toEqual({
      code: 'PROVIDER_5XX',
      retryable: true,
    });
    expect(router.classifyProviderError(apiError(429))).toEqual({
      code: 'RATE_LIMITED',
      retryable: true,
    });
    expect(router.classifyProviderError(new Error('fetch failed: ECONNREFUSED'))).toEqual({
      code: 'NETWORK',
      retryable: true,
    });
    expect(router.classifyProviderError(new Error('request timed out'))).toEqual({
      code: 'TIMEOUT',
      retryable: true,
    });
  });

  it('classifies the typed TimeoutError carrier as TIMEOUT/retryable (WR-03)', () => {
    const router = new ProviderRouter();
    expect(router.classifyProviderError(timeoutError(5_000))).toEqual({
      code: 'TIMEOUT',
      retryable: true,
    });
  });

  it('a user cancel (AbortError) stays UNKNOWN/never-retried (WR-03)', () => {
    const router = new ProviderRouter();
    expect(router.classifyProviderError(new DOMException('aborted', 'AbortError'))).toEqual({
      code: 'UNKNOWN',
      retryable: false,
    });
  });

  it('classifies the non-retryable codes (never retried, never multiplied)', () => {
    const router = new ProviderRouter();
    expect(router.classifyProviderError(apiError(401))).toEqual({
      code: 'PROVIDER_AUTH',
      retryable: false,
    });
    expect(router.classifyProviderError(apiError(404))).toEqual({
      code: 'PROVIDER_MODEL_UNKNOWN',
      retryable: false,
    });
    expect(router.classifyProviderError(apiError(422))).toEqual({
      code: 'SCHEMA_INVALID',
      retryable: false,
    });
  });
});

describe('ProviderRouter — D-16 budgetGuard hook', () => {
  it('the default guard is a no-op pass-through', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock.mockResolvedValueOnce({
      object: { ok: true },
    } as unknown as GenObjectResult);

    await expect(
      inv.callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      ),
    ).resolves.toBe('{"ok":true}');
  });

  it('a refusing guard terminates with budget_blocked before any SDK call', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    router.configure({
      budgetGuard: () => ({ allowed: false, reason: 'monthly cap reached' }),
    });
    const inv = router.createStageInvocation(makeInput());

    let caught: unknown;
    try {
      await inv.callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      );
    } catch (e) {
      caught = e;
    }
    expect((caught as ProviderUnavailableError).reason).toBe('budget_blocked');
    expect(generateObjectMock).not.toHaveBeenCalled();
  });
});

describe('ProviderRouter — F-5 messages[]+providerOptions cache shape (never system:string)', () => {
  it('constructs an anthropic call with messages[] carrying providerOptions.anthropic.cacheControl', async () => {
    mockResolveTier({ providerId: 'anthropic', model: 'claude-haiku-4-latest', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock.mockResolvedValueOnce({
      object: { ok: true },
    } as unknown as GenObjectResult);

    const fixture = buildOptimizedContextFixture();
    await inv.callProviderJsonMode(
      fixture.sections,
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const args = generateObjectMock.mock.calls[0][0] as Record<string, unknown>;
    // F-5: the call is built from messages[] + providerOptions — NOT a system:string param.
    expect('system' in args).toBe(false);
    const messages = args.messages as Array<{
      role: string;
      content: string;
      providerOptions?: unknown;
    }>;
    expect(messages[0].role).toBe('system');
    expect(messages[0].providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });
    expect(messages[1].role).toBe('user');
  });

  it('the cached [SYSTEM] text is the byte-stable persona block (cached kinds joined whole)', async () => {
    mockResolveTier({ providerId: 'anthropic', model: 'claude-haiku-4-latest', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock.mockResolvedValueOnce({
      object: { ok: true },
    } as unknown as GenObjectResult);

    const persona = 'persona.name=Fixture\n\npersona.tone=warm\npersona.brevity=balanced';
    await inv.callProviderJsonMode(
      [section({ kind: 'system', text: persona, tokens: 30 })],
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    const messages = generateObjectMock.mock.calls[0][0].messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages[0].content).toBe(persona); // byte-identical, never split
  });

  it('emits NO providerOptions cache payload when no stable section exists', async () => {
    mockResolveTier({ providerId: 'anthropic', model: 'claude-haiku-4-latest', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());
    generateObjectMock.mockResolvedValueOnce({
      object: { ok: true },
    } as unknown as GenObjectResult);

    await inv.callProviderJsonMode(
      [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
      { type: 'object', properties: {} },
      new AbortController().signal,
    );

    const messages = generateObjectMock.mock.calls[0][0].messages as Array<{
      role: string;
      providerOptions?: unknown;
    }>;
    expect(messages[0].providerOptions).toBeUndefined();
  });
});

describe('ProviderRouter — R-10 TraceRedactor boundary (secrets never logged)', () => {
  it('an api key embedded in a provider error is redacted from every captured log line', async () => {
    mockResolveTier({ providerId: 'openai', model: 'deepseek-chat', fallbackChain: [] });
    const router = new ProviderRouter();
    const inv = router.createStageInvocation(makeInput());

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    generateObjectMock.mockRejectedValue(
      apiError(401, 'invalid api key sk-super-secret-token-123'),
    );

    await inv
      .callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      )
      .catch(() => {});

    const captured = spy.mock.calls.flatMap((c) => c.map((x) => String(x))).join('\n');
    expect(captured).not.toContain('sk-super-secret-token-123');
    spy.mockRestore();
  });

  it('the privacy-hop refusal log carries no prompt or key bodies (R-10)', async () => {
    mockResolveTier(PRIVACY_CHAIN);
    const router = new ProviderRouter();
    const input = makeInput({ privacyMode: 'prefer-local' });
    const inv = router.createStageInvocation(input);
    generateTextMock.mockRejectedValue(apiError(401)); // non-retryable — records the ollama failure

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await inv
      .callProviderJsonMode(
        [section({ kind: 'user_input', text: 'ask', stable: false, sourceId: 'user-input' })],
        { type: 'object', properties: {} },
        new AbortController().signal,
      )
      .catch(() => {});
    // Re-resolution triggers the privacy refusal debugLog.
    try {
      router.createStageInvocation(makeInput({ privacyMode: 'prefer-local' }));
    } catch {
      // expected — privacy_blocked
    }

    const captured = spy.mock.calls.flatMap((c) => c.map((x) => String(x))).join('\n');
    expect(captured).toContain('HOST_NOT_PERMITTED'); // canonical C.2 code used (Golden Rule 9)
    expect(captured).not.toContain('persona.name');
    expect(captured).not.toContain('sk-');
    spy.mockRestore();
  });
});

describe('ProviderRouter — singleton + guards', () => {
  it('getProviderRouter returns the same lazy singleton', () => {
    expect(getProviderRouter()).toBe(getProviderRouter());
  });

  it('isProviderUnconfiguredError recognizes the provider_unconfigured terminal', () => {
    const router = new ProviderRouter();
    mockResolveTier(null);
    let caught: unknown;
    try {
      router.createStageInvocation(makeInput());
    } catch (e) {
      caught = e;
    }
    expect(isProviderUnconfiguredError(caught)).toBe(true);
    expect(isProviderUnconfiguredError(new Error('nope'))).toBe(false);
  });

  it('jsonModeForProvider: ollama → prompt (model-dependent), clouds → native', () => {
    expect(jsonModeForProvider('ollama')).toBe('prompt');
    expect(jsonModeForProvider('openai')).toBe('native');
    expect(jsonModeForProvider('anthropic')).toBe('native');
    expect(jsonModeForProvider('gemini')).toBe('native');
  });
});

describe('ProviderRouter — source invariants (verify task 10)', () => {
  it('ProviderRouter.ts has no prompt.split and no constructed system:string literal', () => {
    const source = readFileSync(join(process.cwd(), 'src/core/ai/ProviderRouter.ts'), 'utf8');
    // Strip `//` and `/* */` comments so the header's prose (which documents the
    // prohibitions verbatim) does not false-match — only CODE is checked.
    const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/prompt\.split\(/);
    expect(code).not.toMatch(/system:\s*['"]/);
  });

  it('PromptSection is imported from @/core/ai/types (D-07 canonical home)', () => {
    const source = readFileSync(join(process.cwd(), 'src/core/ai/ProviderRouter.ts'), 'utf8');
    expect(source).toMatch(/import type \{.*PromptSection.*\} from '@\/core\/ai\/types'/);
  });
});
