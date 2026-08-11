// tests/core/ai/AgentOrchestrator.test.ts — orchestrator contract (03-06,
// Appendix I VERBATIM, D-20). runAgentTurn is the bounded Planner→Executor→
// Renderer loop with the output struct verbatim; the stage services are mocked
// so the ORCHESTRATOR's own invariants are exercised in isolation:
//   - a healthy turn is EXACTLY 2 model calls (one planner + one renderer) —
//     the AI-SPEC "Cost discipline" dimension (executed tools are deterministic,
//     never model calls);
//   - every path terminates in a bounded terminal reasonCode: planner failure →
//     deterministic 'planner_failed' (no re-invocation), provider_unconfigured
//     resolution → 'provider_unconfigured' (no model call), abort → AbortError,
//     caps → planner_cap_reached / tool_cap_reached, success → the planner's
//     reasonCode or 'ask_clarification'; provider-level failures propagate as
//     the visible provider-failure state;
//   - §1.4 caps are enforced ONLY here (Appendix I rule) — capsForTier maps the
//     ModelContextTier to the verbatim {plannerCap, toolCap, mcpChaining} shape;
//   - the onStreamDelta seam streams deltas BEFORE completion (AI-03);
//   - D-20: the orchestrator source carries zero evidence-machinery tokens.
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
    expect(output).toEqual({
      operationId: 'op-turn-0001',
      streamedText: 'final answer',
      toolResults: [],
      reasonCode: 'success',
    });
  });

  it('ask_clarification terminates with the ask_clarification reasonCode (RICH-C-01 substrate)', async () => {
    planMock.mockResolvedValue(CLARIFY);
    const output = await runAgentTurn(baseInput());

    expect(planMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(output.reasonCode).toBe('ask_clarification');
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
    expect(output.toolResults).toHaveLength(1);
    expect(output.toolResults[0].toolName).toBe('get-provider-info');
    expect(output.reasonCode).toBe('success');
    // The Executor receives the decision's toolName/input with the abort signal threaded.
    expect(executeMock.mock.calls[0][0]).toMatchObject({ toolName: 'get-provider-info' });
  });

  it('planner_cap_reached: cap exhaustion terminates before the next planner call', async () => {
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
    expect(output.reasonCode).toBe('planner_cap_reached');
  });

  it('tool_cap_reached: cap exhaustion terminates before the next tool run', async () => {
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
    expect(output.reasonCode).toBe('tool_cap_reached');
  });
});

describe('runAgentTurn — bounded terminal reasonCodes on every path', () => {
  it('planner failure → deterministic planner_failed fallback, NO re-invocation (§1.2, R-2)', async () => {
    planMock.mockRejectedValue(new Error('STRUCTURED_OUTPUT_FAILED: decision invalid twice'));
    renderMock.mockResolvedValue({ text: 'I could not answer that.', finishReason: 'stop' });

    const output = await runAgentTurn(baseInput());

    expect(planMock).toHaveBeenCalledTimes(1); // never a second planner call
    expect(renderMock).toHaveBeenCalledTimes(1); // the visible fallback answer still renders
    expect(output.reasonCode).toBe('planner_failed');
    expect(output.streamedText).toBe('I could not answer that.');
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
    expect(output).toEqual({
      operationId: 'op-turn-0001',
      streamedText: '',
      toolResults: [],
      reasonCode: 'provider_unconfigured',
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

    expect(output.streamedText).toBe('d1');
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

  it('large caps bound the loop: 5 planner / 3 tool caps — run_tool decisions terminate in tool_cap_reached', async () => {
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
    expect(output.reasonCode).toBe('tool_cap_reached');
  });

  it('planner_cap_reached fires when toolCap outlasts plannerCap (verbatim loop check at the top)', async () => {
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
    expect(output.reasonCode).toBe('planner_cap_reached');
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
