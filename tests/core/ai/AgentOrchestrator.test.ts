import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ILLMProvider, LLMStreamRequest } from '../../../src/core/ai/ILLMProvider';
import type { ProviderId, StreamEvent } from '../../../src/core/ai/types';
import {
  runAgentTurn,
  type AgentTurnInput,
  type AgentTier,
} from '../../../src/core/ai/AgentOrchestrator';
import { PlannerService } from '../../../src/core/ai/PlannerService';
import { ProviderRegistry, __test__ as registryTest } from '../../../src/core/ai/ProviderRegistry';
import { __test__ as routerTest } from '../../../src/core/ai/ProviderRouter';
import { useUserPreferencesStore } from '../../../src/core/ai/UserPreferences';
import { __test__ as adapterTest } from '../../../src/core/theme/chromeStorageAdapter';
import { buildPersonaBlock, resolvePersona } from '../../../src/core/ai/persona/PersonaInjector';
import { DEFAULT_PERSONA } from '../../../src/core/ai/persona/PersonaProfile';
import { PROMPTS } from '../../../src/core/prompts';
import { FixtureProvider } from './fixtures/FixtureProvider';
import { OPENAI_ANSWER_STREAM, OPENAI_REPAIR_SUCCESS_STREAM } from './fixtures/openai-stream';

/**
 * AgentOrchestrator contract tests (plan 03-06, Task 2) — the phase's
 * RICH-R-09 gate (persona in all three stage prompts of one turn) and the
 * D-45 gate (persist seam: once per completed turn, never per delta, not on
 * abort).
 *
 * The stage services are REAL (Planner/Executor/Renderer from src/core/ai);
 * only the provider is a fixture (D-48), and the planner is scripted with
 * vi.spyOn ONLY for the run_tool case groups (b)/(d)/(g) — the production
 * zero-tool schema (D-46) makes a real planner unable to emit run_tool.
 *
 * Case groups: (a) happy path · (b) planner_cap_reached · (c) ask_clarification
 * · (d) TOOL_REJECTED · (e) abort · (f) persist seam (D-45) · (g) persona
 * consistency (RICH-R-09) · (h) configuration-required (D-54a).
 */

const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

/** D-48 fixture provider recording every stream() request it hands the pipeline. */
class RecordingProvider implements ILLMProvider {
  readonly providerId: ProviderId;
  readonly streamRequests: LLMStreamRequest[] = [];
  constructor(private readonly inner: FixtureProvider) {
    this.providerId = inner.providerId;
  }
  stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    this.streamRequests.push(request);
    return this.inner.stream(request, signal);
  }
  requestJson(prompt: string, jsonSchema: unknown, signal?: AbortSignal): Promise<string> {
    return this.inner.requestJson(prompt, jsonSchema, signal);
  }
  get prompts(): readonly string[] {
    return this.inner.prompts;
  }
  get streamCalls(): number {
    return this.inner.streamCalls;
  }
}

/** D-48 fixture provider whose stream stalls mid-answer until the caller aborts. */
class SlowAbortStreamProvider implements ILLMProvider {
  readonly providerId = 'openai' as const;
  stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const { operationId } = request;
    return (async function* () {
      yield { type: 'STREAM_START', operationId };
      yield { type: 'STREAM_DELTA', operationId, delta: 'partial answer ' };
      await new Promise((r) => setTimeout(r, 80));
      if (signal?.aborted) return;
      yield { type: 'STREAM_COMPLETE', operationId, fullText: 'partial answer unreachable' };
    })();
  }
  async requestJson(): Promise<string> {
    throw new Error('SlowAbortStreamProvider.requestJson not used');
  }
}

/** Disk shape for the orchestrator tests — a single enabled openai provider. */
const seedDisk = {
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: true,
      enabled: true,
      models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true }],
    },
  },
};

/**
 * Seed the module-level environment the orchestrator consumes:
 * ProviderRegistry (hydrated + fixture registered over 'openai' + D-52 cache)
 * and UserPreferences (fast/balanced persisted — D-54; pass null to leave a
 * tier unpersisted, the D-54a null contract).
 */
async function seedEnv(opts: {
  provider: ILLMProvider;
  fastModel?: string | null;
  balancedModel?: string | null;
}): Promise<void> {
  storageMap.clear();
  adapterTest.resetPendingState();
  registryTest.reset();
  routerTest.resetBreaker();
  storageMap.set('np_providers', JSON.stringify(seedDisk));
  await ProviderRegistry.hydrate();
  ProviderRegistry.registerProvider(opts.provider);
  registryTest.seedCachedModels('openai', ['gpt-4o-mini']);
  useUserPreferencesStore.setState({
    fastModel: opts.fastModel === null ? undefined : (opts.fastModel ?? 'gpt-4o-mini'),
    balancedModel: opts.balancedModel === null ? undefined : (opts.balancedModel ?? 'gpt-4o-mini'),
    personaOverrides: undefined,
  });
}

function baseInput(overrides: Partial<AgentTurnInput> = {}): AgentTurnInput {
  return {
    userInput: 'Help me fix this incident.',
    sessionId: 'session-orchestrator',
    operationId: 'op-orchestrator',
    tier: { plannerCap: 3, toolCap: 3, modelTier: 'fast' },
    abortSignal: new AbortController().signal,
    ...overrides,
  };
}

const ANSWER_TEXT = 'Hello world — relayed verbatim by the renderer.';

/** A fixture whose planner requestJson answers and whose stream relays text. */
function answerFixture(): FixtureProvider {
  return new FixtureProvider([OPENAI_ANSWER_STREAM], {
    streamScript: [
      { kind: 'delta', delta: ANSWER_TEXT },
      { kind: 'complete', fullText: ANSWER_TEXT },
    ],
  });
}

beforeEach(async () => {
  storageMap.clear();
  adapterTest.resetPendingState();
  registryTest.reset();
  routerTest.resetBreaker();
  useUserPreferencesStore.setState({
    fastModel: undefined,
    balancedModel: undefined,
    personaOverrides: undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('(a) happy path — answer decision → AgentTurnOutput from the renderer', () => {
  it('planner answers → the renderer streams the answer; reasonCode = the planner reasonCode', async () => {
    const fixture = answerFixture();
    await seedEnv({ provider: fixture });

    const output = await runAgentTurn(baseInput());

    expect(output.reasonCode).toBe('direct_answer');
    expect(output.streamedText).toBe(ANSWER_TEXT);
    expect(output.toolResults).toEqual([]);
    // D-61 outcome contract (04-01 Task 2): status/operationId/evidence/
    // counters/trajectory on the happy path.
    expect(output.status).toBe('completed');
    expect(output.operationId).toBe('op-orchestrator'); // Pitfall 8 correlation
    expect(output.evidence).toEqual([]);
    expect(output.plannerCalls).toBe(1);
    expect(output.toolCalls).toBe(0);
    expect(output.trajectory.phase).toBe('completed');
  });
});

describe('(b) planner_cap_reached — §1.4 cap enforcement (T-3-18)', () => {
  it('a run_tool loop exhausts plannerCap → reasonCode planner_cap_reached', async () => {
    const fixture = answerFixture();
    await seedEnv({ provider: fixture });
    // "Fixture planner" — the production zero-tool schema cannot emit run_tool
    // (D-46), so the run_tool loop is scripted on the real PlannerService module.
    const planSpy = vi
      .spyOn(PlannerService, 'plan')
      .mockResolvedValue({ action: 'run_tool', toolName: 'any_tool', input: {} });

    const output = await runAgentTurn(
      baseInput({ tier: { plannerCap: 2, toolCap: 3, modelTier: 'fast' } }),
    );

    expect(output.reasonCode).toBe('planner_cap_reached');
    // AGT-03 (04-01 Task 2): cap exhaustion → status 'partial', never a
    // successful status. The Phase-3 reasonCode literal above is PRESERVED
    // this plan (the O.2 'cap_exhausted' re-script of case (b) is plan 04-03).
    expect(output.status).toBe('partial');
    // Both planner calls produced a rejected tool call before the cap hit.
    expect(output.toolResults).toHaveLength(2);
    for (const result of output.toolResults) {
      expect(result.code).toBe('TOOL_REJECTED');
    }
    // The finish still renders the final answer.
    expect(output.streamedText).toBe(ANSWER_TEXT);
    expect(planSpy).toHaveBeenCalledTimes(2);
  });
});

describe('(c) ask_clarification — finishes with that reasonCode; question/options surface (RICH-C substrate)', () => {
  it('the clarification decision finishes the turn and its question/options reach the renderer', async () => {
    const fixture = new FixtureProvider([OPENAI_REPAIR_SUCCESS_STREAM], {
      streamScript: [
        { kind: 'delta', delta: 'Which KB article should I use?' },
        { kind: 'complete', fullText: 'Which KB article should I use?' },
      ],
    });
    const provider = new RecordingProvider(fixture);
    await seedEnv({ provider });

    const output = await runAgentTurn(baseInput());

    expect(output.reasonCode).toBe('ask_clarification');
    expect(output.streamedText).toBe('Which KB article should I use?');
    expect(output.toolResults).toEqual([]);
    // A3 mapping (04-01 Task 2): the clarification question IS the renderer
    // output → status 'completed', never a failure.
    expect(output.status).toBe('completed');
    // RICH-C-01 substrate: the focused question + options surface as the
    // user-side content of the renderer's stream request.
    const renderRequest = provider.streamRequests.at(-1);
    expect(renderRequest?.messages[1]?.content).toContain('Which KB article?');
    expect(renderRequest?.messages[1]?.content).toContain('KB001');
    expect(renderRequest?.messages[1]?.content).toContain('KB002');
  });
});

describe('(d) TOOL_REJECTED — the typed rejection surfaces and the loop continues (D-46)', () => {
  it('executor rejects every run_tool; the rejection lands in toolResults; the turn finishes normally', async () => {
    const fixture = answerFixture();
    await seedEnv({ provider: fixture });
    const planSpy = vi
      .spyOn(PlannerService, 'plan')
      .mockResolvedValueOnce({ action: 'run_tool', toolName: 'any_tool', input: { q: 1 } })
      .mockResolvedValueOnce({ action: 'answer', reasonCode: 'direct_answer' });

    const output = await runAgentTurn(baseInput());

    expect(output.reasonCode).toBe('direct_answer');
    expect(output.toolResults).toHaveLength(1);
    expect(output.toolResults[0]?.code).toBe('TOOL_REJECTED');
    expect(output.toolResults[0]?.toolName).toBe('any_tool');
    expect(output.toolResults[0]?.ok).toBe(false);
    expect(output.streamedText).toBe(ANSWER_TEXT);
    expect(planSpy).toHaveBeenCalledTimes(2);
  });
});

describe('(e) abort — AbortError propagates; persistTurn NOT invoked (D-45)', () => {
  it('a pre-aborted signal throws AbortError at the loop-top check; nothing persisted', async () => {
    const fixture = answerFixture();
    await seedEnv({ provider: fixture });
    const controller = new AbortController();
    controller.abort();
    const persistTurn = vi.fn();

    await expect(
      runAgentTurn(baseInput({ abortSignal: controller.signal, persistTurn })),
    ).rejects.toThrow(DOMException);
    expect(persistTurn).not.toHaveBeenCalled();
  });

  it('abort mid-stream during the renderer → AbortError propagates; the partial is dropped; nothing persisted', async () => {
    const provider = new SlowAbortStreamProvider();
    await seedEnv({ provider });
    vi.spyOn(PlannerService, 'plan').mockResolvedValueOnce({
      action: 'answer',
      reasonCode: 'direct_answer',
    });
    const controller = new AbortController();
    const persistTurn = vi.fn();

    const turnPromise = runAgentTurn(baseInput({ abortSignal: controller.signal, persistTurn }));
    await new Promise((r) => setTimeout(r, 30)); // planner stage + first delta flow
    controller.abort();

    await expect(turnPromise).rejects.toThrow(DOMException);
    expect(persistTurn).not.toHaveBeenCalled();
  });
});

describe('(f) PERSIST SEAM (D-45) — exactly once at turn end, never per delta', () => {
  it('persistTurn fires exactly once with the user message + full streamedText (multi-delta stream)', async () => {
    const fixture = new FixtureProvider([OPENAI_ANSWER_STREAM], {
      streamScript: [
        { kind: 'delta', delta: 'A' },
        { kind: 'delta', delta: 'B' },
        { kind: 'delta', delta: 'C' },
        { kind: 'complete', fullText: 'ABC' },
      ],
    });
    await seedEnv({ provider: fixture });
    const persistTurn = vi.fn();

    const output = await runAgentTurn(baseInput({ persistTurn }));

    expect(output.streamedText).toBe('ABC');
    // Three deltas streamed, yet the seam fires exactly once (never per chunk).
    expect(persistTurn).toHaveBeenCalledTimes(1);
    expect(persistTurn).toHaveBeenCalledWith({
      userMessage: 'Help me fix this incident.',
      assistantMessage: 'ABC',
    });
  });
});

describe('(g) PERSONA CONSISTENCY (RICH-R-09 / DONE-when 4) — all three stage prompts of one turn', () => {
  it('the persona block is the string PREFIX of the planner, executor, and renderer system prompts', async () => {
    const fixture = new FixtureProvider([], {
      streamScript: [
        { kind: 'delta', delta: ANSWER_TEXT },
        { kind: 'complete', fullText: ANSWER_TEXT },
      ],
    });
    const provider = new RecordingProvider(fixture);
    await seedEnv({ provider });
    // One run_tool (executor stage fires) + one answer (renderer stage fires)
    // in a single turn — so all three stage prompts are produced.
    vi.spyOn(PlannerService, 'plan')
      .mockResolvedValueOnce({ action: 'run_tool', toolName: 'any_tool', input: {} })
      .mockResolvedValueOnce({ action: 'answer', reasonCode: 'direct_answer' });

    const output = await runAgentTurn(baseInput());
    expect(output.reasonCode).toBe('direct_answer');

    const personaBlock = buildPersonaBlock(resolvePersona(DEFAULT_PERSONA, undefined));
    expect(personaBlock).toContain('NowPilot');

    // Classify the captured requests by their canonical stage string.
    const plannerReqs = provider.streamRequests.filter((r) =>
      r.messages[0]?.content.includes(PROMPTS.planner.system),
    );
    const executorReqs = provider.streamRequests.filter((r) =>
      r.messages[0]?.content.includes('You are executing a tool call'),
    );
    const rendererReqs = provider.streamRequests.filter((r) =>
      r.messages[0]?.content.includes(PROMPTS.renderer.system),
    );
    expect(plannerReqs.length).toBeGreaterThan(0);
    expect(executorReqs.length).toBeGreaterThan(0);
    expect(rendererReqs.length).toBeGreaterThan(0);

    // RICH-R-09 / DONE-when 4: the persona block is prepended FIRST in every
    // stage's system prompt; the persona name appears in all three.
    for (const request of [...plannerReqs, ...executorReqs, ...rendererReqs]) {
      const system = request.messages[0]?.content ?? '';
      expect(system.startsWith(personaBlock)).toBe(true);
      expect(system).toContain('NowPilot');
    }
    // Byte-stability per stage: every renderer request carries the identical prompt.
    const rendererPrompts = rendererReqs.map((r) => r.messages[0]?.content);
    expect(new Set(rendererPrompts).size).toBe(1);
  });
});

describe('(i) CR-06 — renderer mid-stream error surfaces; the seam does NOT fire', () => {
  it('a stream-then-STREAM_ERROR turn rejects with the provider error and persistTurn is never invoked', async () => {
    // The fixture streams one delta then STREAM_ERROR mid-stream — the exact
    // "stream dies after the first token" case the router deliberately does
    // not re-route. finish() must surface the error and skip persistTurn.
    const fixture = new FixtureProvider([], {
      streamScript: [
        { kind: 'delta', delta: 'partial answer' },
        { kind: 'error', code: 'NETWORK', message: 'mid-stream death' },
      ],
    });
    await seedEnv({ provider: fixture });
    vi.spyOn(PlannerService, 'plan').mockResolvedValue({
      action: 'answer',
      reasonCode: 'direct_answer',
    });
    const persistTurn = vi.fn();

    await expect(
      runAgentTurn(baseInput({ persistTurn })),
    ).rejects.toThrow('mid-stream death');
    expect(persistTurn).not.toHaveBeenCalled();
  });
});

describe('(h) configuration-required (D-54a) — unresolved tier → typed outcome, zero provider calls', () => {
  it('fast tier unresolved → runAgentTurn returns the configuration-required outcome; no provider fixture was called', async () => {
    const fixture = answerFixture();
    await seedEnv({ provider: fixture, fastModel: null, balancedModel: 'gpt-4o-mini' });
    const persistTurn = vi.fn();

    const output = await runAgentTurn(baseInput({ persistTurn }));

    expect(output.reasonCode).toBe('configuration_required');
    expect(output.streamedText).toBe('');
    expect(output.toolResults).toEqual([]);
    // D-54a: no provider request started — the fixture was never touched.
    expect(fixture.streamCalls).toBe(0);
    expect(fixture.prompts).toHaveLength(0);
    // Not a completed turn — the persist seam does not fire.
    expect(persistTurn).not.toHaveBeenCalled();
    // A3 mapping (04-01 Task 2): no provider request started → status
    // 'failed' is the honest terminal (never 'completed').
    expect(output.status).toBe('failed');
  });
});