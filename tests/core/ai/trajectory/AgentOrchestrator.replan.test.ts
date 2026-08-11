// tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts — Phase 3a
// (03a-03): the bounded replan-on-tool-failure policy (AGT-04, D-3a-11/12/13).
// Proves:
//   (a) a retryable tool failure fires exactly ONE replan — the planner is
//       invoked again with an F-4 tool_result PromptSection in the input, then
//       a successful re-run completes;
//   (b) a repeated-identical failure (same toolName + same error.code) after
//       the replan is terminal → 'failed' + 'replan_identical_failure' — never
//       a silent success;
//   (c) plannerCalls never exceeds input.tier.plannerCap (D-3a-13);
//   (d) a planner-side failure keeps the planner_failed fallback — no replan
//       (D-3a-11, R-2);
//   (e) an abort mid-replan/mid-verify propagates AbortError (O4, abort wins).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgentTurn } from '@/core/ai/AgentOrchestrator';
import type { AgentTurnInput, StageResolver } from '@/core/ai/AgentOrchestrator';
import { ExecutorService } from '@/core/ai/ExecutorService';
import { PlannerService } from '@/core/ai/PlannerService';
import type { PlannerDecision } from '@/core/ai/PlannerService';
import { RendererService } from '@/core/ai/RendererService';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import type { LanguageModel } from 'ai';
import { buildOptimizedContextFixture } from '../../../fixtures/optimizedContext';

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

function makeResolver(): StageResolver {
  return () => stageInvocation();
}

const DANGEROUS_TOOL = 'mock-dangerous-write';
const FAILURE_CODE = 'TOOL_FAILED';

function retryableFailure(toolName = DANGEROUS_TOOL, code = FAILURE_CODE) {
  return {
    toolName,
    ok: false,
    error: { code, message: 'transient failure', retryable: true },
    durationMs: 1,
  };
}

function okResult(toolName = DANGEROUS_TOOL) {
  return { toolName, ok: true, output: { written: true }, durationMs: 1 };
}

function baseInput(overrides: Partial<AgentTurnInput> = {}): AgentTurnInput {
  return {
    operationId: 'op-replan-0001',
    userInput: 'Write the note.',
    context: buildOptimizedContextFixture(),
    abortSignal: new AbortController().signal,
    tier: { plannerCap: 3, toolCap: 2, mcpChaining: false },
    invocation: makeResolver(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  renderMock.mockResolvedValue({ text: 'final answer', finishReason: 'stop' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runAgentTurn — replan-on-tool-failure (AGT-04, D-3a-11)', () => {
  it('(a) a retryable tool failure fires exactly ONE replan with a tool_result section, then a successful re-run completes', async () => {
    planMock
      .mockResolvedValueOnce({ action: 'run_tool', toolName: DANGEROUS_TOOL, input: {} })
      // The replan re-invokes the planner with the failure feedback.
      .mockResolvedValueOnce({ action: 'run_tool', toolName: DANGEROUS_TOOL, input: {} })
      .mockResolvedValueOnce({ action: 'answer', reasonCode: 'success' });
    executeMock
      .mockResolvedValueOnce(retryableFailure(DANGEROUS_TOOL))
      .mockResolvedValueOnce(okResult(DANGEROUS_TOOL));

    const outcome = await runAgentTurn(
      baseInput({ tier: { plannerCap: 4, toolCap: 2, mcpChaining: false } }),
    );

    expect(outcome).toMatchObject({ status: 'completed' });
    // Exactly ONE replan: the planner was re-invoked with the tool_result section
    // appended to the input sections (F-4, Pitfall 7 — never a joined string).
    expect(planMock).toHaveBeenCalledTimes(3);
    const replanCall = planMock.mock.calls[1][0];
    const sectionKinds = replanCall.context.sections.map((s: { kind: string }) => s.kind);
    expect(sectionKinds).toContain('tool_result');
    const toolResultSection = replanCall.context.sections.find(
      (s: { kind: string }) => s.kind === 'tool_result',
    ) as { text: string; stable: boolean; sourceId: string } | undefined;
    expect(toolResultSection).toBeDefined();
    expect(toolResultSection).toMatchObject({
      stable: false,
      sourceId: 'replan-feedback',
    });
    expect(toolResultSection?.text).toContain(DANGEROUS_TOOL);
    expect(toolResultSection?.text).toContain(FAILURE_CODE);
    // The failed tool ran once, the replan re-ran it once successfully.
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(renderMock).toHaveBeenCalledTimes(1); // rendered once at finish (D-3a-14)
  });

  it('(b) a repeated-identical failure after the replan is terminal — failed/replan_identical_failure, never a silent success', async () => {
    planMock
      .mockResolvedValueOnce({ action: 'run_tool', toolName: DANGEROUS_TOOL, input: {} })
      // The replan re-invokes the planner; it chooses the SAME tool again.
      .mockResolvedValueOnce({ action: 'run_tool', toolName: DANGEROUS_TOOL, input: {} });
    executeMock
      .mockResolvedValueOnce(retryableFailure(DANGEROUS_TOOL, FAILURE_CODE))
      .mockResolvedValueOnce(retryableFailure(DANGEROUS_TOOL, FAILURE_CODE));

    const outcome = await runAgentTurn(baseInput());

    expect(outcome).toMatchObject({
      status: 'failed',
      reasonCode: 'replan_identical_failure',
    });
    // Exactly one replan happened; the identical second failure was terminal.
    expect(planMock).toHaveBeenCalledTimes(2);
    expect(executeMock).toHaveBeenCalledTimes(2);
    // D-3a-12: never a silent success — the failed terminal still renders once.
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it('(c) plannerCalls never exceeds plannerCap (D-3a-13) — a persistently failing tool is bounded', async () => {
    planMock.mockResolvedValue({ action: 'run_tool', toolName: DANGEROUS_TOOL, input: {} });
    executeMock.mockResolvedValue(retryableFailure(DANGEROUS_TOOL, FAILURE_CODE));

    const outcome = await runAgentTurn(
      baseInput({ tier: { plannerCap: 3, toolCap: 2, mcpChaining: false } }),
    );

    // plannerCalls ≤ plannerCap (3): the replan consumes a slot, then the
    // repeated-identical terminal fires — never more planner calls than the cap.
    expect(outcome.plannerCalls).toBeLessThanOrEqual(3);
    expect(outcome.status).toBe('failed');
    expect(outcome.reasonCode).toBe('replan_identical_failure');
  });

  it('(d) a planner-side failure keeps the planner_failed fallback — no replan (D-3a-11, R-2)', async () => {
    planMock.mockRejectedValue(new Error('STRUCTURED_OUTPUT_FAILED: decision invalid twice'));
    renderMock.mockResolvedValue({ text: 'I could not answer that.', finishReason: 'stop' });

    const outcome = await runAgentTurn(baseInput());

    expect(planMock).toHaveBeenCalledTimes(1); // never a second planner call
    expect(executeMock).not.toHaveBeenCalled(); // a planner failure never replans a tool
    expect(outcome).toMatchObject({ status: 'failed', reasonCode: 'planner_failed' });
    expect(renderMock).toHaveBeenCalledTimes(1); // the visible fallback answer renders
  });

  it('(e) an abort mid-replan propagates AbortError (O4, abort wins mid-replan/mid-verify)', async () => {
    const controller = new AbortController();
    planMock
      .mockResolvedValueOnce({ action: 'run_tool', toolName: DANGEROUS_TOOL, input: {} })
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    executeMock.mockResolvedValueOnce(retryableFailure(DANGEROUS_TOOL, FAILURE_CODE));

    // First run_tool fails retryably → the loop restores and re-invokes the
    // planner, which now rejects with AbortError → propagates unchanged.
    await expect(
      runAgentTurn(baseInput({ abortSignal: controller.signal })),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(renderMock).not.toHaveBeenCalled();
  });
});
