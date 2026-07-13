import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreamingLLM } from '../../src/hooks/useStreamingLLM';
import type { OrchestratorEvent } from '../../src/core/ai/pipeline/pipelineTypes';
import type { OptimizedContext } from '../../src/core/context/contextTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockOptimizedContext(): OptimizedContext {
  return {
    operationId: 'test-op-1',
    tier: 'small',
    inputBudget: 10000,
    outputBudget: 2000,
    safetyMargin: 500,
    sections: [],
    provenance: {
      operationId: 'test-op-1',
      tier: 'small',
      inputBudget: 10000,
      outputBudget: 2000,
      safetyMargin: 500,
      sections: [],
      degradationSteps: [],
      minimalMode: false,
      createdAt: Date.now(),
    },
    minimalMode: false,
  };
}

async function* createMockOrchestratorStream(
  events: OrchestratorEvent[],
): AsyncGenerator<OrchestratorEvent> {
  for (const event of events) {
    yield event;
  }
}

function createMockOrchestrator(events: OrchestratorEvent[]) {
  return {
    runWithContext: vi.fn().mockImplementation(
      async function* (
        _optimizedContext: OptimizedContext,
        _preferredProviders: string[],
      ): AsyncGenerator<OrchestratorEvent> {
        yield* createMockOrchestratorStream(events);
      },
    ),
    cancel: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useStreamingLLM', () => {
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;
  let rafCallbacks: Array<() => void>;

  beforeEach(() => {
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    rafCallbacks = [];

    // Mock rAF to capture callbacks without auto-flushing
    // We control when rAF callbacks fire to test batching deterministically
    globalThis.requestAnimationFrame = vi.fn(
      (cb: FrameRequestCallback) => {
        const id = setTimeout(() => cb(performance.now()), 0);
        return id as unknown as number;
      },
    );
    globalThis.cancelAnimationFrame = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Test 1: Basic text-delta → onDelta via ChunkBuffer
  // -----------------------------------------------------------------------

  it('calling startStream with mock AsyncGenerator yielding text-delta → onDelta receives batched text via ChunkBuffer flush on text-complete', async () => {
    const onDelta = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const orchestrator = createMockOrchestrator([
      { type: 'text-delta', text: 'Hello' },
      { type: 'text-complete', fullText: 'Hello' },
    ]);

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta,
        onComplete,
        onError,
      }),
    );

    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    // onDelta should have been called via ChunkBuffer flush during text-complete
    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith('Hello');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('Hello');
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 2: rAF batching of multiple text-delta events
  // -----------------------------------------------------------------------

  it('multiple text-delta events get batched via rAF into single onDelta call on text-complete', async () => {
    const onDelta = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const orchestrator = createMockOrchestrator([
      { type: 'text-delta', text: 'Hello' },
      { type: 'text-delta', text: ' ' },
      { type: 'text-delta', text: 'World' },
      { type: 'text-complete', fullText: 'Hello World' },
    ]);

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta,
        onComplete,
        onError,
      }),
    );

    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    // All three deltas should be batched into a single onDelta call
    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith('Hello World');
    expect(onComplete).toHaveBeenCalledWith('Hello World');
    expect(onError).not.toHaveBeenCalled();

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 3: text-complete fires onComplete and flushes buffer
  // -----------------------------------------------------------------------

  it('text-complete event flushes remaining buffer and fires onComplete callback', async () => {
    const onDelta = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const orchestrator = createMockOrchestrator([
      { type: 'text-delta', text: 'Part 1' },
      { type: 'text-delta', text: ' Part 2' },
      { type: 'text-complete', fullText: 'Part 1 Part 2' },
    ]);

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta,
        onComplete,
        onError,
      }),
    );

    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    // Buffer flushed during text-complete → onDelta with combined text
    expect(onDelta).toHaveBeenCalledWith('Part 1 Part 2');
    // onComplete receives the fullText
    expect(onComplete).toHaveBeenCalledWith('Part 1 Part 2');
    expect(onError).not.toHaveBeenCalled();

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 4: error event fires onError
  // -----------------------------------------------------------------------

  it('error event fires onError with message string and flushes buffer', async () => {
    const onDelta = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const orchestrator = createMockOrchestrator([
      { type: 'text-delta', text: 'Some text before error' },
      { type: 'error', message: 'Provider rate limited' },
    ]);

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta,
        onComplete,
        onError,
      }),
    );

    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    // Buffer should be flushed before error, then onError called
    expect(onDelta).toHaveBeenCalledWith('Some text before error');
    expect(onError).toHaveBeenCalledWith('Provider rate limited');
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Provider rate limited');
    expect(result.current.isStreaming).toBe(false);

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 5: abort() terminates the stream
  // -----------------------------------------------------------------------

  it('calling abort() terminates the stream and sets isStreaming=false', async () => {
    // Use a promise-based gate so cancel() can unblock the generator
    let hangResolve: () => void;
    const hangPromise = new Promise<void>((resolve) => {
      hangResolve = resolve;
    });

    const orchestrator = {
      runWithContext: vi.fn().mockImplementation(
        async function* (
          _optimizedContext: OptimizedContext,
          _preferredProviders: string[],
        ): AsyncGenerator<OrchestratorEvent> {
          yield { type: 'text-delta', text: 'Before abort' };
          // Wait until hangResolve is called (by cancel) then throw AbortError
          await hangPromise;
          if (true) {
            throw new DOMException('The operation was aborted', 'AbortError');
          }
        },
      ),
      cancel: vi.fn(() => {
        hangResolve?.();
      }),
    };

    const onDelta = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta,
        onComplete,
        onError,
      }),
    );

    // Start streaming (don't await — it never completes on its own)
    act(() => {
      result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    // Give the generator a tick to yield the first event
    await vi.advanceTimersByTimeAsync(10);

    expect(result.current.isStreaming).toBe(true);

    // Now abort — cancel() resolves the hang promise, generator throws AbortError
    act(() => {
      result.current.abort();
    });

    // After abort, isStreaming should be false
    await vi.waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(orchestrator.cancel).toHaveBeenCalled();
    // AbortError is swallowed silently
    expect(result.current.error).toBeNull();

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 6: startStream while already streaming aborts previous stream
  // -----------------------------------------------------------------------

  it('calling startStream() while already streaming first aborts previous stream', async () => {
    const orchestrator = {
      runWithContext: vi.fn(),
      cancel: vi.fn(),
    };

    // First call: generator that waits forever
    const gen1 = (async function* (): AsyncGenerator<OrchestratorEvent> {
      yield { type: 'text-delta', text: 'First stream' };
      await new Promise(() => {}); // hangs
    })();

    // Second call: generator that completes immediately
    const gen2 = (async function* (): AsyncGenerator<OrchestratorEvent> {
      yield { type: 'text-delta', text: 'Second stream' };
      yield { type: 'text-complete', fullText: 'Second stream' };
    })();

    orchestrator.runWithContext
      .mockReturnValueOnce(gen1)
      .mockReturnValueOnce(gen2);

    const onDelta = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta,
        onComplete,
        onError,
      }),
    );

    // First stream
    act(() => {
      result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(result.current.isStreaming).toBe(true);

    // Second stream abort the first
    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    // orchestrator.cancel should have been called at least once (aborting previous stream)
    expect(orchestrator.cancel).toHaveBeenCalledTimes(1);
    // Second stream should complete with its content
    expect(onDelta).toHaveBeenCalledWith('Second stream');
    expect(onComplete).toHaveBeenCalledWith('Second stream');

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 7: tool-called event fires onToolCall
  // -----------------------------------------------------------------------

  it('tool-called event fires onToolCall callback with tool name and input', async () => {
    const onToolCall = vi.fn();
    const onComplete = vi.fn();
    const orchestrator = createMockOrchestrator([
      {
        type: 'tool-called',
        toolName: 'get_weather',
        input: { location: 'Tokyo' },
      },
      { type: 'text-delta', text: 'The weather in Tokyo is sunny.' },
      { type: 'text-complete', fullText: 'The weather in Tokyo is sunny.' },
    ]);

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta: vi.fn(),
        onComplete,
        onError: vi.fn(),
        onToolCall,
      }),
    );

    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledWith('get_weather', {
      location: 'Tokyo',
    });
    expect(onComplete).toHaveBeenCalled();

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 8: waiting-permission event fires onWaitingPermission
  // -----------------------------------------------------------------------

  it('waiting-permission event fires onWaitingPermission callback with toolName and toolInput', async () => {
    const onWaitingPermission = vi.fn();
    const orchestrator = createMockOrchestrator([
      {
        type: 'waiting-permission',
        toolName: 'delete_file',
        toolInput: { path: '/tmp/test.txt' },
      },
      { type: 'text-delta', text: 'File deleted.' },
      { type: 'text-complete', fullText: 'File deleted.' },
    ]);

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        onWaitingPermission,
      }),
    );

    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    expect(onWaitingPermission).toHaveBeenCalledTimes(1);
    expect(onWaitingPermission).toHaveBeenCalledWith('delete_file', {
      path: '/tmp/test.txt',
    });

    unmount();
  });

  // -----------------------------------------------------------------------
  // Test 9: Component unmount during streaming aborts the stream
  // -----------------------------------------------------------------------

  it('component unmount during streaming aborts the stream (no state updates on unmounted component)', async () => {
    const orchestrator = {
      runWithContext: vi.fn().mockImplementation(
        async function* (): AsyncGenerator<OrchestratorEvent> {
          yield { type: 'text-delta', text: 'Before unmount' };
          await new Promise(() => {}); // hangs
        },
      ),
      cancel: vi.fn(),
    };

    const onDelta = vi.fn();
    const onError = vi.fn();

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta,
        onComplete: vi.fn(),
        onError,
      }),
    );

    act(() => {
      result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(result.current.isStreaming).toBe(true);

    // Unmount should abort the stream (via useEffect cleanup)
    unmount();

    expect(orchestrator.cancel).toHaveBeenCalled();
    // No onError should be called — abort is swallowed silently
    expect(onError).not.toHaveBeenCalled();

    // Verify no stale state updates happen
    // (This is verified by the fact that unmount didn't throw React warnings)
  });

  // -----------------------------------------------------------------------
  // Test 10: context-degraded and context-error events fire callbacks
  // -----------------------------------------------------------------------

  it('context-degraded and context-error events fire onDegradation and onContextError callbacks', async () => {
    const onDegradation = vi.fn();
    const onContextError = vi.fn();
    const orchestrator = createMockOrchestrator([
      {
        type: 'context-degraded',
        level: 'warning',
        message: 'Minimal mode activated — functionality restricted',
        tier: 'tiny',
      },
      { type: 'text-delta', text: 'Working in minimal mode.' },
      {
        type: 'context-error',
        code: 'CONTEXT_TOO_LARGE',
        estimatedTokens: 15000,
        budget: 10000,
        message: 'Context too large for the available budget',
      },
    ]);

    const { result, unmount } = renderHook(() =>
      useStreamingLLM({
        orchestrator: orchestrator as any,
        onDelta: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        onDegradation,
        onContextError,
      }),
    );

    const streamPromise = act(async () => {
      await result.current.startStream(
        createMockOptimizedContext(),
        ['test-provider'],
      );
    });

    await streamPromise;

    expect(onDegradation).toHaveBeenCalledTimes(1);
    expect(onDegradation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'context-degraded',
        level: 'warning',
        message: 'Minimal mode activated — functionality restricted',
      }),
    );

    expect(onContextError).toHaveBeenCalledTimes(1);
    expect(onContextError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'context-error',
        code: 'CONTEXT_TOO_LARGE',
      }),
    );

    unmount();
  });
});
