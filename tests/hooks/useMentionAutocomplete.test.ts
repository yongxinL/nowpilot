import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMentionAutocomplete } from '../../src/hooks/useMentionAutocomplete';

describe('useMentionAutocomplete', () => {
  it('initial state has empty tokens and closed autocomplete', () => {
    const { result } = renderHook(() => useMentionAutocomplete());
    expect(result.current.mentionTokens).toEqual([]);
    expect(result.current.isAutocompleteOpen).toBe(false);
  });

  it('handleTextChange detects @ trigger', () => {
    const { result } = renderHook(() => useMentionAutocomplete());
    act(() => {
      result.current.handleTextChange('Hello @', 7);
    });
    expect(result.current.isAutocompleteOpen).toBe(true);
  });

  it('handleSelectMention adds token', () => {
    const { result } = renderHook(() => useMentionAutocomplete());
    act(() => {
      result.current.handleSelectMention({
        type: 'note',
        id: 'n1',
        title: 'Test Note',
        displayLabel: '@note:Test Note',
      });
    });
    expect(result.current.mentionTokens).toHaveLength(1);
    expect(result.current.mentionTokens[0].type).toBe('note');
  });

  it('handleRemoveMention removes token by id', () => {
    const { result } = renderHook(() => useMentionAutocomplete());
    act(() => {
      result.current.handleSelectMention({
        type: 'note', id: 'n1', title: 'Test', displayLabel: '@note:Test',
      });
      result.current.handleSelectMention({
        type: 'tab', id: 't1', title: 'Tab', displayLabel: '@tab:Tab',
      });
    });
    expect(result.current.mentionTokens).toHaveLength(2);
    act(() => {
      result.current.handleRemoveMention('n1');
    });
    expect(result.current.mentionTokens).toHaveLength(1);
    expect(result.current.mentionTokens[0].type).toBe('tab');
  });
});
