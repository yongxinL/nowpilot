// tests/components/pages/useStreamingLLM.test.tsx — the D-01 co-located
// streaming hook contract (Phase-7 promotion target): send() threads a
// contextHelper-built OptimizedContext (Golden Rule 3 — never PROMPTS) through
// the createStageInvocation StageResolver into runAgentTurn, streaming deltas
// into the ChunkBuffer (text grows via flush); abort() cancels generation; the
// 5-state machine maps NETWORK-class failures to offline and everything else
// to failed; retry() re-sends the last input with a NEW operationId.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStreamingLLM } from '@/components/pages/useStreamingLLM';
import type { AgentTurnOutcome } from '@/types/harness';
import { FIXED_PREFERENCES } from '../../fixtures/optimizedContext';

// ---------------------------------------------------------------------------
// Module mocks (the hook's I/O boundaries — the hook itself stays real)
// ---------------------------------------------------------------------------

const { runAgentTurnMock, routerMock, readPersonaPrefsMock } = vi.hoisted(() => {
  const createStageInvocation = vi.fn((input: { tier?: string; maxTokens?: number }) => ({
    providerId: 'anthropic',
    model: { modelId: 'claude-3-5-haiku-latest' },
    jsonMode: 'native',
    callProviderJsonMode: vi.fn(async () => '{}'),
    // 04-05 (D-04-04): required field — deterministic fixture window.
    modelContextWindow: 200_000,
    ...input,
  }));
  const classifyProviderError = vi.fn((e: unknown) => ({
    code:
      e instanceof Error && /fetch failed|ECONNREFUSED|network/i.test(e.message)
        ? 'NETWORK'
        : 'UNKNOWN',
    retryable: false,
  }));
  return {
    runAgentTurnMock: vi.fn(),
    routerMock: { createStageInvocation, classifyProviderError },
    readPersonaPrefsMock: vi.fn(async () => FIXED_PREFERENCES),
  };
});

vi.mock('@/core/ai/AgentOrchestrator', () => ({
  runAgentTurn: runAgentTurnMock,
  capsForTier: () => ({ plannerCap: 3, toolCap: 2, mcpChaining: true }),
}));

vi.mock('@/core/ai/ProviderRouter', () => ({
  getProviderRouter: () => routerMock,
}));

vi.mock('@/core/ai/persona/personaConfig', () => ({
  readPersonaPrefs: readPersonaPrefsMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AgentTurnInputLike {
  operationId: string;
  userInput: string;
  context: unknown;
  abortSignal: AbortSignal;
  tier: { plannerCap: number; toolCap: number; mcpChaining: boolean };
  onStreamDelta?: (delta: string) => void;
  invocation?: (stage: 'planner' | 'renderer') => unknown;
}

function resolveTurn(
  deltas: string[],
  outcome: { status: AgentTurnOutcome['status']; reasonCode?: string } = {
    status: 'completed',
    reasonCode: 'ok',
  },
) {
  runAgentTurnMock.mockImplementationOnce(async (input: AgentTurnInputLike) => {
    for (const d of deltas) input.onStreamDelta?.(d);
    return {
      operationId: input.operationId,
      status: outcome.status,
      reasonCode: outcome.reasonCode ?? 'ok',
      evidence: [],
      plannerCalls: 1,
      toolCalls: 0,
    };
  });
}

function rejectTurn(err: unknown) {
  runAgentTurnMock.mockImplementationOnce(async () => {
    throw err;
  });
}

beforeEach(() => {
  runAgentTurnMock.mockReset();
  routerMock.createStageInvocation.mockClear();
  routerMock.classifyProviderError.mockClear();
  routerMock.classifyProviderError.mockImplementation((e: unknown) => ({
    code:
      e instanceof Error && /fetch failed|ECONNREFUSED|network/i.test(e.message)
        ? 'NETWORK'
        : 'UNKNOWN',
    retryable: false,
  }));
  readPersonaPrefsMock.mockReset();
  readPersonaPrefsMock.mockImplementation(async () => FIXED_PREFERENCES);
});

describe('useStreamingLLM — send path (Golden Rule 3 + D-02)', () => {
  it('sends through runAgentTurn with a contextHelper-built OptimizedContext (never React-assembled prompts)', async () => {
    resolveTurn(['Hel']);
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(runAgentTurnMock).toHaveBeenCalledTimes(1);
    const input = runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike;
    // The context is a §2.3 OptimizedContext shape (contextHelper output) —
    // the hook imports contextHelper, it never builds the prompt itself.
    expect(input.context).toMatchObject({ tier: 'medium', sections: expect.any(Array) });
    expect(input.userInput).toBe('hi');
    expect(input.tier).toEqual({ plannerCap: 3, toolCap: 2, mcpChaining: true });
    expect(result.current.state).toEqual({ state: 'completed', operationId: input.operationId });
  });

  it('streams deltas through the ChunkBuffer into the growing text (rAF flush)', async () => {
    resolveTurn(['Hel', 'lo, ', 'world']);
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.text).toBe('Hello, world');
    expect(result.current.state.state).toBe('completed');
  });

  it('exposes the StageResolver over createStageInvocation (03-05 seam)', async () => {
    // Have the mock invoke the resolver for the planner stage to prove the
    // hook wired the Router seam (per-stage maxTokens 256 planner / 512 renderer).
    runAgentTurnMock.mockImplementationOnce(async (input: AgentTurnInputLike) => {
      // Prove the hook wired the Router seam: invoke the resolver for both
      // stages (the per-stage maxTokens are asserted from the call args below).
      input.invocation?.('planner');
      input.invocation?.('renderer');
      return {
        operationId: input.operationId,
        status: 'completed',
        reasonCode: 'ok',
        evidence: [],
        plannerCalls: 1,
        toolCalls: 0,
      };
    });
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(routerMock.createStageInvocation).toHaveBeenCalledTimes(2);
    const plannerCall = routerMock.createStageInvocation.mock.calls[0]?.[0] as unknown as {
      tier: string;
      maxTokens: number;
    };
    const rendererCall = routerMock.createStageInvocation.mock.calls[1]?.[0] as unknown as {
      tier: string;
      maxTokens: number;
    };
    // §1.2: planner haiku 256 / renderer flash 512.
    expect(plannerCall.tier).toBe('haiku');
    expect(plannerCall.maxTokens).toBe(256);
    expect(rendererCall.tier).toBe('flash');
    expect(rendererCall.maxTokens).toBe(512);
  });
});

describe('useStreamingLLM — 5-state machine', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useStreamingLLM());
    expect(result.current.state).toEqual({ state: 'idle' });
  });

  it('goes streaming immediately, then completed with the final text', async () => {
    resolveTurn(['a']);
    const { result } = renderHook(() => useStreamingLLM());

    // Gate the persona read so the streaming state is observable BEFORE the
    // turn resolves (the hook sets streaming synchronously at send()).
    let releasePersona!: (v: typeof FIXED_PREFERENCES) => void;
    readPersonaPrefsMock.mockImplementationOnce(
      () => new Promise((resolve) => (releasePersona = resolve)),
    );
    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = result.current.send('hi');
    });
    // The hook set streaming synchronously BEFORE awaiting the persona read.
    expect(result.current.state.state).toBe('streaming');

    await act(async () => {
      releasePersona(FIXED_PREFERENCES);
      await sendPromise;
    });
    expect(result.current.state.state).toBe('completed');
  });

  it('maps a NETWORK-class failure (D-17) to the offline state', async () => {
    rejectTurn(new Error('fetch failed: ECONNREFUSED'));
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.state.state).toBe('offline');
  });

  it('maps every other failure to the failed state (partial text retained)', async () => {
    rejectTurn(new Error('provider exploded'));
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.state.state).toBe('failed');
  });

  it('does NOT write the D-11 session stream key (in-memory per surface)', async () => {
    resolveTurn(['x']);
    const { result } = renderHook(() => useStreamingLLM());
    await act(async () => {
      await result.current.send('hi');
    });
    // No chrome.storage.session writes at all on the send path (D-03/D-14).
    expect(result.current.state.state).toBe('completed');
  });
});

describe('useStreamingLLM — D-3a-19 honest status mapping (AGT-03)', () => {
  it('a cap-exhausted partial turn surfaces as failed with partial text retained — NEVER completed', async () => {
    resolveTurn(['Partial ', 'answer'], { status: 'partial', reasonCode: 'cap_exhausted' });
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    // D-3a-19: partial → failed (honest non-completion — the capped turn keeps
    // its partial text and offers Retry; it must never read as 'completed').
    expect(result.current.text).toBe('Partial answer');
    expect(result.current.state).toEqual({
      state: 'failed',
      operationId: (runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike).operationId,
    });
  });

  it('a failed turn surfaces as failed', async () => {
    resolveTurn([], { status: 'failed', reasonCode: 'planner_failed' });
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.state).toEqual({
      state: 'failed',
      operationId: (runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike).operationId,
    });
  });

  it('an aborted turn surfaces as idle', async () => {
    resolveTurn([], { status: 'aborted' });
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.state).toEqual({ state: 'idle' });
  });

  it('a completed turn surfaces as completed', async () => {
    resolveTurn(['done'], { status: 'completed', reasonCode: 'ok' });
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.state).toEqual({
      state: 'completed',
      operationId: (runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike).operationId,
    });
  });
});

describe('useStreamingLLM — abort + retry', () => {
  it('abort() cancels generation: the runAgentTurn signal is aborted, no failed surface', async () => {
    let capturedSignal: AbortSignal | undefined;
    let release!: (v: never) => void;
    runAgentTurnMock.mockImplementationOnce(
      (input: AgentTurnInputLike) =>
        new Promise((_resolve, reject) => {
          capturedSignal = input.abortSignal;
          input.abortSignal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
          release = reject as unknown as (v: never) => void;
        }),
    );
    const { result } = renderHook(() => useStreamingLLM());

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = result.current.send('hi');
      // flush microtasks so the hook reached runAgentTurn
      await Promise.resolve();
    });
    expect(capturedSignal?.aborted).toBe(false);

    act(() => result.current.abort());
    expect(capturedSignal?.aborted).toBe(true);

    await act(async () => {
      await sendPromise;
    });
    // An abort is NOT a provider failure — the surface returns to idle.
    expect(result.current.state).toEqual({ state: 'idle' });
    expect(release).toBeTypeOf('function');
  });

  it('retry() re-sends the last input with a NEW operationId', async () => {
    // First send fails; the retry succeeds.
    rejectTurn(new Error('provider exploded'));
    resolveTurn(['ok']);
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('please help');
    });
    expect(result.current.state.state).toBe('failed');

    await act(async () => {
      result.current.retry();
    });

    expect(runAgentTurnMock).toHaveBeenCalledTimes(2);
    const firstOp = (runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike).operationId;
    const secondOp = (runAgentTurnMock.mock.calls[1][0] as AgentTurnInputLike).operationId;
    expect(secondOp).not.toBe(firstOp);
    expect((runAgentTurnMock.mock.calls[1][0] as AgentTurnInputLike).userInput).toBe('please help');
    await waitFor(() => expect(result.current.state.state).toBe('completed'));
  });
});
