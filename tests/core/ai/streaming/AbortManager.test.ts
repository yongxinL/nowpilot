import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AbortManager } from '../../../../src/core/ai/streaming/AbortManager';

describe('AbortManager', () => {
  let abortManager: AbortManager;

  beforeEach(() => {
    vi.useFakeTimers();
    abortManager = new AbortManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('root cancel propagates to all child signals', () => {
    const child1 = abortManager.createStageTimeout(5000);
    const child2 = abortManager.createStageTimeout(5000);

    const onAbort1 = vi.fn();
    const onAbort2 = vi.fn();
    child1.addEventListener('abort', onAbort1);
    child2.addEventListener('abort', onAbort2);

    expect(child1.aborted).toBe(false);
    expect(child2.aborted).toBe(false);

    abortManager.cancel('User cancelled');

    expect(onAbort1).toHaveBeenCalledTimes(1);
    expect(onAbort2).toHaveBeenCalledTimes(1);
    expect(child1.aborted).toBe(true);
    expect(child2.aborted).toBe(true);
  });

  it('stage timeout fires independently after specified ms', () => {
    const child = abortManager.createStageTimeout(100);

    const onAbort = vi.fn();
    child.addEventListener('abort', onAbort);

    expect(child.aborted).toBe(false);

    vi.advanceTimersByTime(100);

    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(child.aborted).toBe(true);
    expect(child.reason).toBeInstanceOf(DOMException);
    expect((child.reason as DOMException).name).toBe('TimeoutError');
  });

  it('root abort during stage timeout clears the timeout and propagates root reason', () => {
    const child = abortManager.createStageTimeout(5000);

    const onAbort = vi.fn();
    child.addEventListener('abort', onAbort);

    // Root cancels before timeout fires
    abortManager.cancel('User cancelled');

    // Advance past the timeout — it should have been cleared
    vi.advanceTimersByTime(5000);

    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(child.aborted).toBe(true);
    expect(child.reason).toBeInstanceOf(DOMException);
    expect((child.reason as DOMException).name).toBe('AbortError');
  });

  it('child signal abort does NOT affect root controller', () => {
    const child = abortManager.createStageTimeout(100);

    expect(abortManager.isAborted).toBe(false);

    vi.advanceTimersByTime(100);

    expect(child.aborted).toBe(true);
    // Root should NOT be aborted — child timeout is isolated
    expect(abortManager.isAborted).toBe(false);
  });

  it('root cancel propagates to all children; individual child timeout only affects that child', () => {
    const fastChild = abortManager.createStageTimeout(100);
    const slowChild = abortManager.createStageTimeout(5000);

    const onFastAbort = vi.fn();
    const onSlowAbort = vi.fn();
    fastChild.addEventListener('abort', onFastAbort);
    slowChild.addEventListener('abort', onSlowAbort);

    // Fast child times out
    vi.advanceTimersByTime(100);

    expect(onFastAbort).toHaveBeenCalledTimes(1);
    expect(fastChild.aborted).toBe(true);
    expect(slowChild.aborted).toBe(false);
    expect(abortManager.isAborted).toBe(false);

    // Root cancel propagates to slow child (and fast child doesn't fire again)
    abortManager.cancel('User cancelled');

    expect(onSlowAbort).toHaveBeenCalledTimes(1);
    expect(slowChild.aborted).toBe(true);
    // fastChild listener shouldn't fire again
    expect(onFastAbort).toHaveBeenCalledTimes(1);
  });

  it('isAborted returns true after cancel', () => {
    expect(abortManager.isAborted).toBe(false);
    abortManager.cancel();
    expect(abortManager.isAborted).toBe(true);
  });
});
