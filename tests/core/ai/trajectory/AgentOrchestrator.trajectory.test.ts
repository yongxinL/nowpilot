// tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts — Phase 3a
// (03a-03): the orchestrator's trajectory state machine (AGT-01, D-3a-10/16).
// runAgentTurn returns the C.1 AgentTurnOutcome and emits a transition at each
// stage boundary via the optional input-only onTransition callback (D-3a-16,
// mirrors onStreamDelta — direct calls, never an event bus, L1):
//   assembling-context → planning → rendering → completed (healthy answer turn)
// Proves:
//   (a) healthy plan→answer turn records assembling→planning→rendering→completed
//       and returns AgentTurnOutcome { status:'completed', evidence:[] };
//   (b) the trajectory cap (plannerCap+toolCap+1, D-3a-10) force-terminates as
//       'partial' + 'trajectory_cap_exceeded' when a retryable-failure replan
//       cascade exceeds the ceiling;
//   (c) an illegal transition surfaces AGENT_STATE_INVALID (C5) — exercised via
//       the canonical transitionPhase guard the loop uses;
//   (d) the pause seam (D-3a-15/16): an ask_clarification decision transitions
//       to 'waiting-for-permission', calls onInputRequired, and the turn stays
//       open until aborted (abort wins, O4).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgentTurn, trajectoryCapFor } from '@/core/ai/AgentOrchestrator';
import type { AgentTurnInput, StageResolver } from '@/core/ai/AgentOrchestrator';
import { ExecutorService } from '@/core/ai/ExecutorService';
import { PlannerService } from '@/core/ai/PlannerService';
import type { PlannerDecision } from '@/core/ai/PlannerService';
import { RendererService } from '@/core/ai/RendererService';
import type { StageInvocation } from '@/core/ai/ProviderRouter';
import { transitionPhase } from '@/types/harness';
import type { AgentTrajectoryPhase, AgentTrajectoryState } from '@/types/harness';
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

function baseInput(overrides: Partial<AgentTurnInput> = {}): AgentTurnInput {
  return {
    operationId: 'op-trajectory-0001',
    userInput: 'Summarize the current page.',
    context: buildOptimizedContextFixture(),
    abortSignal: new AbortController().signal,
    tier: { plannerCap: 2, toolCap: 2, mcpChaining: false },
    invocation: makeResolver(),
    ...overrides,
  };
}

function recordTransitions(
  input: AgentTurnInput,
): { transitions: AgentTrajectoryState[]; record: (s: AgentTrajectoryState) => void } {
  const transitions: AgentTrajectoryState[] = [];
  const record = (s: AgentTrajectoryState) => transitions.push(s);
  input.onTransition = record;
  return { transitions, record };
}

beforeEach(() => {
  vi.clearAllMocks();
  renderMock.mockResolvedValue({ text: 'final answer', finishReason: 'stop' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runAgentTurn — trajectory transitions (AGT-01, D-3a-16)', () => {
  it('(a) a healthy plan→answer turn records assembling→planning→rendering→completed and returns completed with no evidence', async () => {
    planMock.mockResolvedValue({ action: 'answer', reasonCode: 'success' });
    const input = baseInput();
    const { transitions, record } = recordTransitions(input);
    void record;

    const outcome = await runAgentTurn(input);

    const phases = transitions.map((t) => t.phase);
    expect(phases).toEqual([
      'assembling-context',
      'planning',
      'rendering',
      'completed',
    ]);
    expect(outcome).toMatchObject({ status: 'completed', evidence: [] });
    // The terminal status is the C.1 'completed'; the reasonCode comes from
    // buildOutcome ('ok') — the planner's 'success' reasonCode is not carried
    // into the outcome (03a-04 migrates reasonCode assertions to status).
    expect(outcome.status).toBe('completed');
    expect(planMock).toHaveBeenCalledTimes(1); // exactly 2 model calls (planner + renderer)
    expect(executeMock).not.toHaveBeenCalled();
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it('(b) the trajectory cap force-terminates partial/trajectory_cap_exceeded when the loop exceeds plannerCap+toolCap+1', async () => {
    // A retryable-failure cascade: the planner chooses a FRESH tool each replan,
    // so replannedTools never blocks (D-3a-12 repeated-identical can't fire),
    // and each replan consumes a planner slot (D-3a-13) — plannerCalls+toolCalls
    // climbs past the ceiling and the trajectory check (FIRST at loop top) fires.
    const cap = trajectoryCapFor({ plannerCap: 3, toolCap: 2, mcpChaining: false });
    expect(cap).toBe(6); // plannerCap + toolCap + 1
    let toolSeq = 0;
    planMock.mockImplementation(async () => {
      toolSeq += 1;
      return {
        action: 'run_tool',
        toolName: `mock-dangerous-write-${toolSeq}`,
        input: {},
      } as PlannerDecision;
    });
    executeMock.mockImplementation(async (input) => ({
      toolName: input.toolName,
      ok: false,
      error: { code: 'TOOL_FAILED', message: 'retryable', retryable: true },
      durationMs: 1,
    }));

    const input = baseInput({ tier: { plannerCap: 3, toolCap: 2, mcpChaining: false } });
    const { transitions } = recordTransitions(input);
    const outcome = await runAgentTurn(input);

    // The sum exceeded the ceiling, so the trajectory cap (not cap_exhausted)
    // force-terminated the turn as partial.
    expect(outcome).toMatchObject({ status: 'partial', reasonCode: 'trajectory_cap_exceeded' });
    expect(outcome.reasonCode).not.toBe('cap_exhausted');
    const phases = transitions.map((t) => t.phase);
    // The cascade emitted at least one replanning before rendering terminated it.
    expect(phases).toContain('replanning');
    expect(phases).toContain('executing');
    expect(phases[phases.length - 1]).toBe('rendering'); // partial stops at rendering
    expect(planMock).toHaveBeenCalledTimes(2); // initial plan + one replan, then the cap fires
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(renderMock).toHaveBeenCalledTimes(1); // rendered once with accumulated results
  });

  it('(c) an illegal transition surfaces AGENT_STATE_INVALID (C5) — the loop uses the canonical guard', () => {
    expect(() => transitionPhase('planning', 'completed')).toThrow(/AGENT_STATE_INVALID/);
    // The legal edges used by the healthy turn do not throw.
    expect(() => transitionPhase('assembling-context', 'planning')).not.toThrow();
    expect(() => transitionPhase('planning', 'rendering')).not.toThrow();
    expect(() => transitionPhase('rendering', 'completed')).not.toThrow();
  });

  it('(d) the pause seam: ask_clarification → waiting-for-permission, onInputRequired called, turn stays open, abort wins', async () => {
    planMock.mockResolvedValue({
      action: 'ask_clarification',
      question: 'Which note?',
      options: ['note-a', 'note-b'],
    });
    const controller = new AbortController();
    const onInputRequired = vi.fn();
    const input = baseInput({ abortSignal: controller.signal, onInputRequired });
    const { transitions } = recordTransitions(input);

    const promise = runAgentTurn(input);
    // The pause seam fires onInputRequired synchronously before the wait.
    await vi.waitFor(() => expect(onInputRequired).toHaveBeenCalledTimes(1));
    expect(onInputRequired).toHaveBeenCalledWith({
      roleId: 'user',
      question: 'Which note?',
      options: ['note-a', 'note-b'],
      reason: 'clarification',
    });
    expect(transitions.map((t) => t.phase)).toContain('waiting-for-permission');

    // Turn is still open (no resolution yet) — abort wins mid-wait (O4).
    let settled = false;
    promise
      .then(() => {
        settled = true;
      })
      .catch(() => {
        settled = true;
      });
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);

    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(renderMock).not.toHaveBeenCalled();
  });
});

describe('trajectoryCapFor — D-3a-10 ceiling (plannerCap + toolCap + 1)', () => {
  it('derives the ceiling from the tier caps with a slack constant of 1', () => {
    expect(trajectoryCapFor({ plannerCap: 1, toolCap: 1, mcpChaining: false })).toBe(3);
    expect(trajectoryCapFor({ plannerCap: 2, toolCap: 1, mcpChaining: false })).toBe(4);
    expect(trajectoryCapFor({ plannerCap: 3, toolCap: 2, mcpChaining: true })).toBe(6);
    expect(trajectoryCapFor({ plannerCap: 5, toolCap: 3, mcpChaining: true })).toBe(9);
  });
});
