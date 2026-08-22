import { describe, it, expect, beforeEach } from 'vitest';
import {
  useWorkspaceStore,
  isPrimaryWriter,
  type ActiveSurface,
} from '../../../src/core/workspace/WorkspaceStore';

describe('WorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  it('initializes with default state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBeTruthy();
    expect(state.conversationId).toBeNull();
    expect(state.activeProvider).toBeNull();
    expect(state.selectedModel).toBeNull();
    expect(state.pinnedTabs).toEqual([]);
    expect(state.activeSurface).toBe('sidepanel');
    expect(state.version).toBe(0);
  });

  it('sets conversation ID', () => {
    const store = useWorkspaceStore.getState();
    store.setConversationId('conv-1');
    expect(useWorkspaceStore.getState().conversationId).toBe('conv-1');
    expect(useWorkspaceStore.getState().version).toBe(1);
  });

  it('pins and unpins tabs', () => {
    const store = useWorkspaceStore.getState();
    store.pinTab({ tabId: 1, title: 'Test', url: 'https://test.com', pinned: true });
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(1);

    store.unpinTab(1);
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(0);
  });

  it('enforces max 10 pinned tabs', () => {
    const store = useWorkspaceStore.getState();
    for (let i = 0; i < 12; i++) {
      store.pinTab({ tabId: i, title: `Tab ${i}`, url: `https://tab${i}.com`, pinned: true });
    }
    expect(useWorkspaceStore.getState().pinnedTabs).toHaveLength(10);
  });

  it('tracks active surface', () => {
    const store = useWorkspaceStore.getState();
    store.setActiveSurface('standalone');
    expect(useWorkspaceStore.getState().activeSurface).toBe('standalone');
  });

  it('bumps version', () => {
    const store = useWorkspaceStore.getState();
    store.bumpVersion();
    expect(useWorkspaceStore.getState().version).toBe(1);
  });

  it('resets to initial state', () => {
    const store = useWorkspaceStore.getState();
    store.setConversationId('conv-test');
    store.pinTab({ tabId: 1, title: 'Test', url: 'https://test.com', pinned: true });
    store.reset();
    const newState = useWorkspaceStore.getState();
    expect(newState.conversationId).toBeNull();
    expect(newState.pinnedTabs).toEqual([]);
    expect(newState.version).toBe(0);
  });
});

describe('isPrimaryWriter() predicate (D-16, REQ-R05)', () => {
  // Phase 1 contract: always returns true. Phase 2 will swap in real
  // election semantics — see WorkspaceStore.ts swap-point comment.

  it('returns true when called with no arguments', () => {
    expect(isPrimaryWriter()).toBe(true);
  });

  it('returns true on a second call (proves the stub is not stateful)', () => {
    expect(isPrimaryWriter()).toBe(true);
    expect(isPrimaryWriter()).toBe(true);
  });
});

describe('ActiveSurface union (D-07 canonicalization)', () => {
  it("accepts 'standalone' as a valid value", () => {
    const surface: ActiveSurface = 'standalone';
    expect(surface).toBe('standalone');
  });

  it("accepts 'sidepanel' as a valid value", () => {
    const surface: ActiveSurface = 'sidepanel';
    expect(surface).toBe('sidepanel');
  });

  it("rejects 'full-app' at the type level (canonical rename)", () => {
    // @ts-expect-error 'full-app' is no longer a member of ActiveSurface — canonicalized to 'standalone' (D-07).
    const surface: ActiveSurface = 'full-app';
    // Runtime belt-and-braces: if 'full-app' ever re-joined the union, the
    // ts-expect-error directive just above would itself error and this
    // file would fail to compile. The runtime assertion below confirms
    // the literal did reach the assignment (proves the directive was
    // exercised).
    expect(surface).toBe('full-app');
  });
});

