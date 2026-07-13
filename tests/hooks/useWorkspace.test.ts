import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspace } from '../../src/hooks/useWorkspace';
import { useTheme } from '../../src/hooks/useTheme';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';
import { useThemeStore } from '../../src/core/stores/themeStore';

// ---------------------------------------------------------------------------
// useWorkspace tests
// ---------------------------------------------------------------------------

describe('useWorkspace', () => {
  beforeEach(() => {
    // Reset workspace store to defaults before each test
    useWorkspaceStore.setState({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'sidepanel',
      pinnedTabs: [],
      currentPageContext: null,
      selectedNotes: [],
      activeAddonContext: null,
      activeSkillRun: null,
      drafts: {},
    });
  });

  it('returns workspaceId, conversationId, activeProvider, activeSurface from store', () => {
    // Set up initial store state
    useWorkspaceStore.setState({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      activeProvider: 'anthropic',
      activeSurface: 'standalone',
    });

    const { result } = renderHook(() => useWorkspace());

    expect(result.current.workspaceId).toBe('ws-1');
    expect(result.current.conversationId).toBe('conv-1');
    expect(result.current.activeProvider).toBe('anthropic');
    expect(result.current.activeSurface).toBe('standalone');
    expect(result.current.drafts).toEqual({});
  });

  it('setActiveProvider updates the store', () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setActiveProvider('test-provider');
    });

    expect(result.current.activeProvider).toBe('test-provider');
    // Verify via store directly
    expect(useWorkspaceStore.getState().activeProvider).toBe('test-provider');
  });

  it('setConversationId updates the store', () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setConversationId('conv-123');
    });

    expect(result.current.conversationId).toBe('conv-123');
    expect(useWorkspaceStore.getState().conversationId).toBe('conv-123');
  });

  it('setDraft and clearDraft work correctly', () => {
    const { result } = renderHook(() => useWorkspace());

    act(() => {
      result.current.setDraft('conv-1', 'Hello draft');
    });

    expect(result.current.drafts).toEqual({ 'conv-1': 'Hello draft' });

    act(() => {
      result.current.clearDraft('conv-1');
    });

    expect(result.current.drafts).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// useTheme tests
// ---------------------------------------------------------------------------

describe('useTheme', () => {
  beforeEach(() => {
    // Reset theme store to defaults
    useThemeStore.setState({ mode: 'auto' });
  });

  it('returns mode from themeStore', () => {
    useThemeStore.setState({ mode: 'light' });

    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe('light');
  });

  it('setMode updates the store', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode('dark');
    });

    expect(result.current.mode).toBe('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });
});
