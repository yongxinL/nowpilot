// tests/components/pages/useStreamingLLM.test.tsx — the D-01 co-located
// streaming hook contract (Phase-7 promotion target): send() threads a
// per-stage ContextOptimizer-built OptimizedContext (04-06 rewire, D-04-04/05 —
// Golden Rule 3, never PROMPTS) through the createStageInvocation StageResolver
// into runAgentTurn, streaming deltas into the ChunkBuffer (text grows via
// flush); abort() cancels generation; the 5-state machine maps NETWORK-class
// failures to offline, a ContextTooLargeError to failed (D-04-15 honest
// terminal — never truncation), and everything else to failed; retry() re-sends
// the last input with a NEW operationId.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStreamingLLM } from '@/components/pages/useStreamingLLM';
import {
  DEFAULT_CONTEXT_TIER,
  FALLBACK_MODEL_CONTEXT_WINDOW,
} from '@/components/pages/useStreamingLLM';
import { classifyModelContext } from '@/core/context/ModelContextTier';
import { estimateTokens } from '@/core/context/TokenBudget';
import { buildPersonaBlock, resolvePersona } from '@/core/ai/persona/PersonaInjector';
import { DEFAULT_PERSONA } from '@/core/ai/persona/PersonaProfile';
import type { PromptSection } from '@/core/ai/types';
import type { AgentTurnOutcome } from '@/types/harness';
import { FIXED_PREFERENCES } from '../../fixtures/optimizedContext';

// ---------------------------------------------------------------------------
// Module mocks (the hook's I/O boundaries — the hook itself stays real)
// ---------------------------------------------------------------------------

const { runAgentTurnMock, routerMock, readPersonaPrefsMock, capsTierCalls } = vi.hoisted(() => {
  const capsTierCalls: string[] = [];
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
    capsTierCalls,
  };
});

vi.mock('@/core/ai/AgentOrchestrator', () => ({
  runAgentTurn: runAgentTurnMock,
  // Records the tier argument (D-04-05 — the PLANNER-stage tier governs loop
  // caps) while returning the constant caps shape the Phase-3 tests assert.
  capsForTier: (tier: string) => {
    capsTierCalls.push(tier);
    return { plannerCap: 3, toolCap: 2, mcpChaining: true };
  },
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
  // D-04-05 seam (04-06): the per-stage optimizer packs the hook threads in.
  contextForStage?: (stage: 'planner' | 'renderer') => unknown;
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
  routerMock.createStageInvocation.mockReset();
  // Re-establish the default 200_000 fixture window (mockReset clears the
  // implementation, so per-test overrides cannot leak into later tests).
  routerMock.createStageInvocation.mockImplementation(
    (input: { tier?: string; maxTokens?: number }) => ({
      providerId: 'anthropic',
      model: { modelId: 'claude-3-5-haiku-latest' },
      jsonMode: 'native',
      callProviderJsonMode: vi.fn(async () => '{}'),
      modelContextWindow: 200_000,
      ...input,
    }),
  );
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
  capsTierCalls.length = 0;
});

describe('useStreamingLLM — send path (Golden Rule 3 + D-02)', () => {
  it('sends through runAgentTurn with an optimizer-built OptimizedContext (never React-assembled prompts)', async () => {
    resolveTurn(['Hel']);
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    expect(runAgentTurnMock).toHaveBeenCalledTimes(1);
    const input = runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike;
    // The context is a §2.3 OptimizedContext shape — the hook imports
    // ContextOptimizer, it never builds the prompt itself. The tier is DERIVED
    // from the hoisted mock's modelContextWindow (200_000, 04-05 T2) via
    // classifyModelContext → 'large' (D-04-04 — never the 'medium' constant).
    expect(input.context).toMatchObject({ tier: 'large', sections: expect.any(Array) });
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

  it('exposes the StageResolver over createStageInvocation — both stages resolved upfront (04-06 rewire)', async () => {
    // D-04-04/05: the hook resolves BOTH stages upfront to read each
    // StageInvocation's modelContextWindow for the per-stage optimizer calls
    // (no longer resolved lazily inside runAgentTurn).
    resolveTurn(['ok']);
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

describe('useStreamingLLM — per-stage optimizer contexts (04-06 rewire, D-04-04/05)', () => {
  it('runs optimize per stage: two createStageInvocation calls, capsForTier(planner tier) + contextForStage threaded', async () => {
    resolveTurn(['ok']);
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    // both stages resolved upfront via the Router seam (the window source)
    expect(routerMock.createStageInvocation).toHaveBeenCalledTimes(2);
    const input = runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike;
    // 200_000 mock window → 'large' for both stages (D-04-04 derivation)
    expect(input.context).toMatchObject({ tier: 'large' });
    // capsForTier was invoked with the PLANNER-stage tier, not the renderer's
    expect(capsTierCalls).toEqual(['large']);
    // the loop-cap shape comes from the mocked capsForTier (constant caps)
    expect(input.tier).toEqual({ plannerCap: 3, toolCap: 2, mcpChaining: true });
    // the input-only seam exposes the per-stage packs
    const rendererCtx = input.contextForStage?.('renderer') as { tier?: string };
    expect(rendererCtx).toBeDefined();
    expect(rendererCtx.tier).toBe('large');
  });

  it('per-stage tier divergence: planner tiny / renderer large — capsForTier receives the PLANNER tier (D-04-05, T-04-27)', async () => {
    routerMock.createStageInvocation.mockImplementation((input: { maxTokens?: number }) => ({
      providerId: 'anthropic',
      model: { modelId: 'claude-3-5-haiku-latest' },
      jsonMode: 'native',
      callProviderJsonMode: vi.fn(async () => '{}'),
      // planner stage (maxTokens 256) → tiny window; renderer (512) → large
      modelContextWindow: input?.maxTokens === 256 ? 4096 : 200_000,
      ...input,
    }));
    resolveTurn(['ok']);
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    const input = runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike;
    // planner context: tiny → mandatory minimal mode
    expect(input.context).toMatchObject({ tier: 'tiny', minimalMode: true });
    // renderer context: large, no minimal mode — the stages DIFFER
    const rendererCtx = input.contextForStage?.('renderer') as {
      tier?: string;
      minimalMode?: boolean;
    };
    expect(rendererCtx.tier).toBe('large');
    expect(rendererCtx.minimalMode).toBe(false);
    // loop caps come from the PLANNER-stage tier (tiny), never the renderer's
    expect(capsTierCalls).toEqual(['tiny']);
  });
});

describe('useStreamingLLM — D-04-04 fallback-constant consistency', () => {
  it('FALLBACK_MODEL_CONTEXT_WINDOW derives the DEFAULT_CONTEXT_TIER — the constants cannot disagree', () => {
    // A 16_384 fallback would derive 'small' and contradict the retained
    // 'medium' tier constant; the 131_072 window keeps the pair consistent.
    expect(classifyModelContext(FALLBACK_MODEL_CONTEXT_WINDOW)).toBe(DEFAULT_CONTEXT_TIER);
  });
});

describe('useStreamingLLM — drop-in identity + honest terminal (04-06 rewire)', () => {
  it('drop-in regression: the default-path section bytes equal the pre-04-06 snapshot (D-04-07/P4-8)', async () => {
    resolveTurn(['ok']);
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('hi');
    });

    const input = runAgentTurnMock.mock.calls[0][0] as AgentTurnInputLike;
    // Pre-04-06 the hook built exactly [SYSTEM: personaBlock][USER INPUT: trimmed]
    // via the Phase-3 context-helper; the optimizer's default path (200_000 →
    // large, non-minimal) is byte-identical — the section bytes prove the
    // drop-in (prompt-cache stability, D-04-07).
    const personaBlock = buildPersonaBlock(resolvePersona(DEFAULT_PERSONA, FIXED_PREFERENCES));
    expect((input.context as { sections: PromptSection[] }).sections).toEqual([
      {
        kind: 'system',
        text: personaBlock,
        tokens: estimateTokens(personaBlock),
        stable: true,
        sourceId: 'system',
      },
      {
        kind: 'user_input',
        text: 'hi',
        tokens: estimateTokens('hi'),
        stable: false,
        sourceId: 'user-input',
      },
    ]);
  });

  it('a ContextTooLargeError (over-cap input even in minimal mode) → failed — never offline/completed (D-04-15, T-04-25)', async () => {
    routerMock.createStageInvocation.mockImplementation((input: { maxTokens?: number }) => ({
      providerId: 'anthropic',
      model: { modelId: 'claude-3-5-haiku-latest' },
      jsonMode: 'native',
      callProviderJsonMode: vi.fn(async () => '{}'),
      modelContextWindow: 4096, // tiny — a 12k-char input exceeds even minimal mode
      ...input,
    }));
    const { result } = renderHook(() => useStreamingLLM());

    await act(async () => {
      await result.current.send('a'.repeat(12_000));
    });

    // The optimizer threw BEFORE runAgentTurn — the hook maps the typed
    // terminal to the honest failed state with the messageTooLong surface
    // (never a truncated prompt sent, never 'offline', never 'completed').
    expect(runAgentTurnMock).not.toHaveBeenCalled();
    expect(result.current.state.state).toBe('failed');
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
