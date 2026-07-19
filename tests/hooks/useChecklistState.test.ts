import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChecklistState } from '../../src/hooks/useChecklistState';

describe('useChecklistState', () => {
  it('toggleItem toggles check state per messageId', () => {
    const { result } = renderHook(() => useChecklistState());
    act(() => {
      result.current.toggleItem('msg-1', 0);
    });
    const progress = result.current.getProgress('msg-1', 3);
    expect(progress.completed).toBe(1);
    expect(progress.percent).toBe(33);
  });

  it('messageId isolation: toggling one does not affect another', () => {
    const { result } = renderHook(() => useChecklistState());
    act(() => {
      result.current.toggleItem('msg-1', 0);
      result.current.toggleItem('msg-2', 1);
    });
    const p1 = result.current.getProgress('msg-1', 2);
    const p2 = result.current.getProgress('msg-2', 2);
    expect(p1.completed).toBe(1);
    expect(p2.completed).toBe(1);
  });

  it('all completed shows 100%', () => {
    const { result } = renderHook(() => useChecklistState());
    act(() => {
      result.current.toggleItem('msg-1', 0);
      result.current.toggleItem('msg-1', 1);
    });
    const progress = result.current.getProgress('msg-1', 2);
    expect(progress.completed).toBe(2);
    expect(progress.percent).toBe(100);
  });
});
