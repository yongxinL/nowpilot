// tests/core/ai/AgentOrchestrator.test.ts — orchestrator contract (03-06,
// Appendix I VERBATIM, D-20 FENCE INVERTED by 3a). runAgentTurn is the bounded
// Planner→Executor→Renderer loop returning the C.1 AgentTurnOutcome (03a-03,
// D-3a-18); the stage services are mocked so the ORCHESTRATOR's own invariants
// are exercised in isolation:
//   - a healthy turn is EXACTLY 2 model calls (one planner + one renderer) —
//     the AI-SPEC "Cost discipline" dimension (executed tools are deterministic,
//     never model calls);
//   - every path terminates in a bounded terminal STATUS: planner failure →
//     'failed'/'planner_failed' (no re-invocation), provider_unconfigured
//     resolution → 'failed'/'provider_unconfigured' (no model call), abort →
//     AbortError, caps → 'partial'/'cap_exhausted' (AGT-03 — never
//     'completed'), success → 'completed'; provider-level failures propagate as
//     the visible provider-failure state;
//   - §1.4 caps are enforced ONLY here (Appendix I rule) — capsForTier maps the
//     ModelContextTier to the verbatim {plannerCap, toolCap, mcpChaining} shape;
//   - the onStreamDelta seam streams deltas BEFORE completion (AI-03);
//   - D-20 inverted (D-3a-18): the orchestrator source OWNS the reliability
//     machinery (AgentTurnOutcome, trajectory, buildOutcome).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLANNER_TIMEOUT_MS, capsForTier, runAgentTurn } from '@/core/ai/AgentOrchestrator';
import type { AgentTurnInput, StageResolver } from '@/core/ai/AgentOrchestrator';
import { ExecutorService } from '@/core/ai/ExecutorService';
import { PlannerService } from '@/core/ai/PlannerService';
import type { PlannerDecision } from '@/core/ai/PlannerService';
import { RendererService } from '@/core/ai/RendererService';
import type {
  ProviderUnavailableError,
  ProviderUnavailableReason,
  StageInvocation,
} from '@/core/ai/ProviderRouter';
import type { LanguageModel } from 'ai';
import { buildOptimizedContextFixture } from '../../fixtures/optimizedContext';

// Stage services mocked — the orchestrator's loop/caps/terminal logic is what
// this suite proves (the services' own contracts are covered by 03-04/03-06).
vi.mock('@/core/ai/PlannerService', () => ({ PlannerService: { plan: vi.fn() } }));
vi.mock('@/core/ai/ExecutorService', () => ({ ExecutorService: { execute: vi.fn() } }));
vi.mock('@/core/ai/RendererService', () => ({ RendererService: { render: vi.fn() } }));

const planMock = vi.mocked(PlannerService.plan);
const executeMock = vi.mocked(ExecutorService.execute);
const renderMock = vi.mocked(RendererService.render);

const fakeModel = {
  id: 'fixture-model',
  vendor: 'fixture',
  modelId: 'deepseek-chat',
} as unknown as LanguageModel;

function stageInvocation(overrides: Partial<StageInvocation> = {}): StageInvocation {
  return {
    providerId: 'openai',
    model: fakeModel,
    jsonMode: 'native',
    callProviderJsonMode: vi.fn(async () => '{}'),
    ...overrides,
  };
}

function makeResolver(
  opts: {
    planner?: StageInvocation;
    renderer?: StageInvocation;
    throwOn?: 'planner' | 'renderer';
    error?: unknown;
  } = {},
): StageResolver {
  return (stage) => {
    if (opts.throwOn === stage) throw opts.error ?? new Error(`resolver failed for ${stage}`);
    return stage === 'planner'
      ? (opts.planner ?? stageInvocation())
      : (opts.renderer ?? stageInvocation());
  };
}

function providerUnavailable(
  reason: ProviderUnavailableReason,
  providerId?: string,
): ProviderUnavailableError {
  const err = new Error(`PROVIDER_UNAVAILABLE: ${reason}`) as ProviderUnavailableError;
  err.code = 'PROVIDER_UNAVAILABLE';
  err.reason = reason;
  err.providerId = providerId as ProviderUnavailableError['providerId'];
  return err;
}

function baseInput(overrides: Partial<AgentTurnInput> = {}): AgentTurnInput {
  return {
    operationId: 'op-turn-0001',
    userInput: 'Summarize the current page.',
    context: buildOptimizedContextFixture(),
    abortSignal: new AbortController().signal,
    tier: { plannerCap: 2, toolCap: 2, mcpChaining: false },
    invocation: makeResolver(),
    ...overrides,
  };
}

const ANSWER: PlannerDecision = { action: 'answer', reasonCode: 'success' };
const CLARIFY: PlannerDecision = {
  action: 'ask_clarification',
  question: 'Which note?',
  options: [],
};
const RUN_TOOL: PlannerDecision = { action: 'run_tool', toolName: 'get-provider-info', input: {} };

beforeEach(() => {
  vi.clearAllMocks();
  renderMock.mockResolvedValue({ text: 'final answer', finishReason: 'stop' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runAgentTurn — healthy turn costs EXACTLY 2 model calls (AI-SPEC cost dimension)', () => {
  it('answer path: one planner + one renderer, no tools, verbatim output', async () => {
    planMock.mockResolvedValue(ANSWER);
    const output = await runAgentTurn(baseInput());

    expect(planMock).toHaveBeenCalledTimes(1);
    expect(executeMock).not.toHaveBeenCalled();
    expect(renderMock).toHaveBeenCalledTimes(1); // 1 planner + 1 renderer = exactly 2 model calls
    // D-3a-18: the output struct is AgentTurnOutcome — streamedText/toolResults
    // left it (text travels via onStreamDelta; tools flow into the render input).
    expect(output).toEqual({
      operationId: 'op-turn-0001',
      status: 'completed',
      reasonCode: 'ok', // buildOutcome: no capHit, no failed side effect
      evidence: [],
      plannerCalls: 1,
      toolCalls: 0,
    });
  });

  it('ask_clarification pauses the turn: onInputRequired fires with the clarification, abort cancels the wait (D-3a-15/16)', async () => {
    planMock.mockResolvedValue(CLARIFY);
    const onInputRequired = vi.fn();
    const controller = new AbortController();

    // 3a rewire: ask_clarification is no longer a terminal — the turn pauses
    // at waiting-for-permission and stays OPEN (AGT-05 seam; resume UI is
    // Phase 8). The 03a-03 trajectory suite proves the pause; this legacy
    // consumer asserts the payload + abort-wins behavior instead of the
    // removed terminal reasonCode.
    const turn = runAgentTurn(
      baseInput({ onInputRequired, abortSignal: controller.signal }),
    );
    await vi.waitFor(() => expect(onInputRequired).toHaveBeenCalledTimes(1));
    expect(onInputRequired).toHaveBeenCalledWith({
      roleId: 'user',
      question: 'Which note?',
      options: [],
      reason: 'clarification',
    });
    controller.abort();
    await expect(turn).rejects.toMatchObject({ name: 'AbortError' }); // abort wins mid-wait (O4)
    expect(renderMock).not.toHaveBeenCalled(); // the turn never reached the renderer
  });

  it('threads the planner-stage invocation into plan() — providerId/model/callProviderJsonMode/timeout', async () => {
    planMock.mockResolvedValue(ANSWER);
    const plannerInv = stageInvocation({ providerId: 'openai', model: fakeModel });
    await runAgentTurn(baseInput({ invocation: makeResolver({ planner: plannerInv }) }));

    const call = planMock.mock.calls[0][0];
    expect(call.providerId).toBe('openai');
    expect(call.model).toBe('deepseek-chat'); // the LanguageModel's modelId (PlanInput.model: string)
    expect(call.callProviderJsonMode).toBe(plannerInv.callProviderJsonMode);
    expect(call.timeoutMs).toBe(PLANNER_TIMEOUT_MS); // §1.2 planner 3s (Appendix L)
  });
});

describe('runAgentTurn — run_tool loop (Planner requests, Executor validates+runs)', () => {
  it('run_tool → execute → replan → answer: tool result lands in toolResults, render once', async () => {
    planMock
      .mockResolvedValueOnce(RUN_TOOL)
      .mockResolvedValueOnce({ action: 'answer', reasonCode: 'success' });
    executeMock.mockResolvedValue({
      toolName: 'get-provider-info',
      ok: true,
      output: [{ id: 'openai', models: ['deepseek-chat'], enabled: true }],
      durationMs: 1,
    });

    const output = await runAgentTurn(baseInput());

    expect(planMock).toHaveBeenCalledTimes(2);
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(output.status).toBe('completed');
    expect(output.reasonCode).toBe('ok');
    // toolResults left the output struct (D-3a-18) — the tool result still
    // lands in the render input where the renderer narrates it.
    expect(renderMock.mock.calls[0][0].toolResults).toHaveLength(1);
    expect(renderMock.mock.calls[0][0].toolResults[0].toolName).toBe('get-provider-info');
    // The Executor receives the decision's toolName/input with the abort signal threaded.
    expect(executeMock.mock.calls[0][0]).toMatchObject({ toolName: 'get-provider-info' });
  });

  it('planner cap exhaustion: capHit terminates before the next planner call (partial/cap_exhausted, AGT-03)', async () => {
    planMock.mockResolvedValue(RUN_TOOL);
    executeMock.mockResolvedValue({
      toolName: 'get-provider-info',
      ok: true,
      output: [],
      durationMs: 1,
    });

    const output = await runAgentTurn(
      baseInput({ tier: { plannerCap: 1, toolCap: 1, mcpChaining: false } }),
    );

    expect(planMock).toHaveBeenCalledTimes(1); // cap checked BEFORE the 2nd plan
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(output.status).toBe('partial'); // AGT-03: cap exhaustion is honest non-completion
    expect(output.reasonCode).toBe('cap_exhausted');
  });

  it('tool cap exhaustion: capHit terminates before the next tool run (partial/cap_exhausted, AGT-03)', async () => {
    planMock.mockResolvedValue(RUN_TOOL);
    executeMock.mockResolvedValue({
      toolName: 'get-provider-info',
      ok: true,
      output: [],
      durationMs: 1,
    });

    const output = await runAgentTurn(
      baseInput({ tier: { plannerCap: 2, toolCap: 1, mcpChaining: false } }),
    );

    expect(planMock).toHaveBeenCalledTimes(2);
    expect(executeMock).toHaveBeenCalledTimes(1); // tool cap checked BEFORE the 2nd run
    expect(output.status).toBe('partial'); // AGT-03: never 'completed'
    expect(output.reasonCode).toBe('cap_exhausted');
  });
});

describe('runAgentTurn — bounded terminal reasonCodes on every path', () => {
  it('planner failure → deterministic planner_failed fallback, NO re-invocation (§1.2, R-2)', async () => {
    planMock.mockRejectedValue(new Error('STRUCTURED_OUTPUT_FAILED: decision invalid twice'));
    renderMock.mockResolvedValue({ text: 'I could not answer that.', finishReason: 'stop' });

    const output = await runAgentTurn(baseInput());

    expect(planMock).toHaveBeenCalledTimes(1); // never a second planner call
    expect(renderMock).toHaveBeenCalledTimes(1); // the visible fallback answer still renders
    expect(output.status).toBe('failed');
    expect(output.reasonCode).toBe('planner_failed');
    // streamedText left the output struct (D-3a-18) — the fallback text
    // travels via onStreamDelta; render-ran is the evidence it was produced.
  });

  it('provider_unconfigured resolution → provider_unconfigured reasonCode with NO model call', async () => {
    const output = await runAgentTurn(
      baseInput({
        invocation: makeResolver({
          throwOn: 'planner',
          error: providerUnavailable('provider_unconfigured'),
        }),
      }),
    );

    expect(planMock).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
    // D-3a-19: provider_unconfigured stays a FAILED terminal (status 'failed'
    // + reasonCode — unchanged UX); no model call ever started.
    expect(output).toEqual({
      operationId: 'op-turn-0001',
      status: 'failed',
      reasonCode: 'provider_unconfigured',
      evidence: [],
      plannerCalls: 0,
      toolCalls: 0,
    });
  });

  it('provider-level resolution failure (no_candidate) propagates — visible provider-failure state, never planner_failed', async () => {
    const noCandidate = providerUnavailable('no_candidate');

    await expect(
      runAgentTurn(
        baseInput({ invocation: makeResolver({ throwOn: 'planner', error: noCandidate }) }),
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', reason: 'no_candidate' });
    expect(planMock).not.toHaveBeenCalled();
  });

  it('a provider-level failure INSIDE the planner propagates (budget_blocked), not converted to planner_failed', async () => {
    planMock.mockRejectedValue(providerUnavailable('budget_blocked'));

    await expect(runAgentTurn(baseInput({}))).rejects.toMatchObject({ reason: 'budget_blocked' });
    expect(renderMock).not.toHaveBeenCalled();
  });

  it('a pre-aborted turn rejects with AbortError — no stage call ever starts', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(runAgentTurn(baseInput({ abortSignal: controller.signal }))).rejects.toMatchObject(
      {
        name: 'AbortError',
      },
    );
    expect(planMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it('an abort surfacing inside the planner propagates as AbortError — never planner_failed', async () => {
    planMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    await expect(runAgentTurn(baseInput({}))).rejects.toMatchObject({ name: 'AbortError' });
    expect(planMock).toHaveBeenCalledTimes(1);
    expect(renderMock).not.toHaveBeenCalled();
  });
});

describe('runAgentTurn — onStreamDelta seam (AI-03): deltas BEFORE completion', () => {
  it('streams deltas via the caller callback strictly before the output resolves, and render receives the same seam', async () => {
    planMock.mockResolvedValue(ANSWER);
    const order: string[] = [];
    const onStreamDelta = vi.fn((d: string) => order.push(`delta:${d}`));
    renderMock.mockImplementation(async (input) => {
      input.onDelta?.('d1');
      await Promise.resolve();
      return { text: 'd1', finishReason: 'stop' };
    });

    const output = await runAgentTurn(baseInput({ onStreamDelta }));
    order.push('completed');

    // streamedText left the output struct (D-3a-18) — the seam claim is
    // proven by the delta order (strictly before completion) + the render
    // receiving the caller's seam.
    expect(order).toEqual(['delta:d1', 'completed']); // deltas strictly before completion
    expect(renderMock.mock.calls[0][0].onDelta).toBe(onStreamDelta); // the caller's seam
  });
});

describe('capsForTier — §1.4 verbatim caps shape (never ModelContextTier)', () => {
  it('maps each tier to the { plannerCap, toolCap, mcpChaining } shape (tiny 1/1, small 2/1, medium 3/2, large 5/3)', () => {
    expect(capsForTier('tiny')).toEqual({ plannerCap: 1, toolCap: 1, mcpChaining: false });
    expect(capsForTier('small')).toEqual({ plannerCap: 2, toolCap: 1, mcpChaining: false });
    expect(capsForTier('medium')).toEqual({ plannerCap: 3, toolCap: 2, mcpChaining: true });
    expect(capsForTier('large')).toEqual({ plannerCap: 5, toolCap: 3, mcpChaining: true });
  });

  it('large caps bound the loop: 5 planner / 3 tool caps — run_tool decisions terminate in partial/cap_exhausted', async () => {
    planMock.mockResolvedValue(RUN_TOOL);
    executeMock.mockResolvedValue({
      toolName: 'get-provider-info',
      ok: true,
      output: [],
      durationMs: 1,
    });

    const output = await runAgentTurn(
      baseInput({ tier: capsForTier('large'), operationId: 'op-turn-large' }),
    );

    expect(planMock).toHaveBeenCalledTimes(4); // the 4th plan hits the 3-tool cap
    expect(executeMock).toHaveBeenCalledTimes(3); // never beyond toolCap 3
    expect(output.status).toBe('partial');
    expect(output.reasonCode).toBe('cap_exhausted');
  });

  it('planner cap fires when toolCap outlasts plannerCap (verbatim loop check at the top) — partial/cap_exhausted', async () => {
    planMock.mockResolvedValue(RUN_TOOL);
    executeMock.mockResolvedValue({
      toolName: 'get-provider-info',
      ok: true,
      output: [],
      durationMs: 1,
    });

    const output = await runAgentTurn(
      baseInput({ tier: { plannerCap: 2, toolCap: 5, mcpChaining: false } }),
    );

    expect(planMock).toHaveBeenCalledTimes(2); // never beyond plannerCap 2
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(output.status).toBe('partial');
    expect(output.reasonCode).toBe('cap_exhausted');
  });
});

describe('AgentOrchestrator — D-20 source invariant (INVERTED by 3a, D-3a-18)', () => {
  it('the orchestrator source OWNS the reliability machinery (the Phase-3 fence is inverted)', () => {
    const src = readFileSync(join(process.cwd(), 'src/core/ai/AgentOrchestrator.ts'), 'utf8');
    // Phase 3a inverted the D-20 fence: the orchestrator now embeds
    // trajectory transitions, buildOutcome, and the AgentTurnOutcome return
    // (03a-03). Asserting the OLD absence contract would silently rot (Pitfall 1).
    expect(src).toMatch(/AgentTurnOutcome|OutcomeVerifier|trajectory/);
  });
});
