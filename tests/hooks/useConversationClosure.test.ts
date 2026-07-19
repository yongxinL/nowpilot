import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConversationClosure } from '../../src/hooks/useConversationClosure';

describe('useConversationClosure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test 1: Returns showPrompt=false when isStreaming=true
  it('returns showPrompt=false when isStreaming=true (even with messages)', () => {
    const { result } = renderHook(() =>
      useConversationClosure(3, true, false)
    );

    // Advance time - timer should not fire because streaming
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(result.current.showPrompt).toBe(false);
    expect(result.current.isComplete).toBe(false);
  });

  // Test 2: Returns showPrompt=false when messagesLength=0
  it('returns showPrompt=false when messagesLength=0', () => {
    const { result } = renderHook(() =>
      useConversationClosure(0, false, false)
    );

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(result.current.showPrompt).toBe(false);
  });

  // Test 3: Returns showPrompt=true after 12s idle (messagesLength>0, !isStreaming, !hasActiveClarifications)
  it('returns showPrompt=true after 12s idle', () => {
    const { result } = renderHook(() =>
      useConversationClosure(5, false, false)
    );

    expect(result.current.showPrompt).toBe(false);

    // Advance to just before 12s threshold
    act(() => {
      vi.advanceTimersByTime(11000);
    });
    expect(result.current.showPrompt).toBe(false);

    // Cross the 12s threshold
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.showPrompt).toBe(true);
    expect(result.current.isComplete).toBe(true);
  });

  // Test 4: Returns showPrompt=false after dismiss() called; never shows again
  it('stops showing prompt after dismiss() is called', () => {
    const { result } = renderHook(() =>
      useConversationClosure(5, false, false)
    );

    // Let timer fire to show prompt
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(result.current.showPrompt).toBe(true);

    // Dismiss it
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.showPrompt).toBe(false);

    // Timer should not fire again (already shown once)
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(result.current.showPrompt).toBe(false);
  });

  // Test 5: Timer resets on new messages (re-render with different messagesLength)
  it('resets timer when messagesLength changes', () => {
    const { result, rerender } = renderHook(
      ({ messagesLength, isStreaming, hasActiveClarifications }) =>
        useConversationClosure(messagesLength, isStreaming, hasActiveClarifications),
      { initialProps: { messagesLength: 5, isStreaming: false, hasActiveClarifications: false } }
    );

    // Advance 8s (not yet 12)
    act(() => { vi.advanceTimersByTime(8000); });
    expect(result.current.showPrompt).toBe(false);

    // New message arrives (messagesLength changes) - timer resets
    rerender({ messagesLength: 6, isStreaming: false, hasActiveClarifications: false });

    // Advance 8s again - should not fire because timer was reset to 12s
    act(() => { vi.advanceTimersByTime(8000); });
    expect(result.current.showPrompt).toBe(false);

    // Now cross the threshold
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.showPrompt).toBe(true);
  });

  // Test 6: hasActiveClarifications blocks the prompt
  it('keeps showPrompt=false when hasActiveClarifications=true', () => {
    const { result } = renderHook(() =>
      useConversationClosure(5, false, true)
    );

    act(() => { vi.advanceTimersByTime(20000); });

    expect(result.current.showPrompt).toBe(false);
  });
});
