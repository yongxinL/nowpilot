// tests/core/workspace/WorkspaceStore.test.ts — WorkspaceStore contract tests (WSPC-01):
// hydrate from chrome.storage.local np_workspace with §21.5 defaults when empty,
// start() activates the surface and writes the D-18 active fields, update()
// preserves inert fields untouched (D-18 / T-1-05), chrome.storage.onChanged
// foreign-surface writes adopt with version-LWW (T-1-13: malformed storage is
// never merged), and init failure falls back to defaults without throwing
// (Golden Rule 9). Uses the wxt fakeBrowser chrome.* stubs (WxtVitest
// extensionApiMock) — same pattern as ThemeStore.test.ts; runs in the default
// jsdom-align environment.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { useWorkspaceStore, NP_WORKSPACE_KEY } from '@/core/workspace/WorkspaceStore';
import type { WorkspaceState } from '@/types/workspace';

function freshWorkspace(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    workspaceId: 'ws-local',
    conversationId: 'conv-local',
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'sidepanel',
    version: 0,
    updatedAt: 1000,
    ...overrides,
  };
}

function resetStore(): void {
  useWorkspaceStore.setState({ workspace: freshWorkspace(), isReady: false });
}

afterEach(() => {
  vi.restoreAllMocks();
  useWorkspaceStore.getState().stop();
  resetStore();
});

describe('WorkspaceStore', () => {
  it('init with empty storage returns §21.5 defaults', async () => {
    await useWorkspaceStore.getState().init();

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId.length).toBeGreaterThan(0);
    expect(ws.conversationId.length).toBeGreaterThan(0);
    expect(ws.activeSurface).toBe('sidepanel');
    expect(ws.pinnedTabs).toEqual([]);
    expect(ws.selectedNotes).toEqual([]);
    expect(useWorkspaceStore.getState().isReady).toBe(true);
  });

  it('init with a stored np_workspace hydrates the active fields', async () => {
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: 'ws-stored',
        conversationId: 'conv-stored',
        activeSurface: 'standalone',
        version: 4,
        updatedAt: 2000,
      },
    });

    await useWorkspaceStore.getState().init();

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe('ws-stored');
    expect(ws.conversationId).toBe('conv-stored');
    expect(ws.activeSurface).toBe('standalone');
    expect(ws.version).toBe(4);
    // Inert fields fall back to defaults.
    expect(ws.pinnedTabs).toEqual([]);
    expect(ws.selectedNotes).toEqual([]);
  });

  it('start(surface) sets activeSurface and writes np_workspace', async () => {
    await useWorkspaceStore.getState().init();
    await useWorkspaceStore.getState().start('standalone');

    expect(useWorkspaceStore.getState().workspace.activeSurface).toBe('standalone');
    expect(useWorkspaceStore.getState().workspace.version).toBe(1);

    const stored = (await fakeBrowser.storage.local.get(NP_WORKSPACE_KEY)) as Record<
      string,
      { activeSurface?: string; workspaceId?: string; version?: number }
    >;
    expect(stored.np_workspace.activeSurface).toBe('standalone');
    expect(stored.np_workspace.workspaceId).toBe(
      useWorkspaceStore.getState().workspace.workspaceId,
    );
    expect(stored.np_workspace.version).toBe(1);
  });

  it('update preserves inert fields untouched (D-18)', () => {
    useWorkspaceStore.setState({
      workspace: freshWorkspace({
        activeProvider: 'anthropic',
        selectedNotes: ['note-1', 'note-2'],
        pinnedTabs: [
          {
            tabId: 7,
            windowId: 3,
            page: {
              url: 'https://example.com',
              origin: 'https://example.com',
              hostname: 'example.com',
              title: 'Example',
              meta: {},
              extractedAt: 1000,
            },
            pinnedAt: 1000,
          },
        ],
      }),
      isReady: true,
    });

    useWorkspaceStore.getState().update((draft) => {
      draft.activeSurface = 'standalone';
    });

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.activeSurface).toBe('standalone');
    expect(ws.version).toBe(1);
    // Inert D-18 fields were never touched by the mutation.
    expect(ws.activeProvider).toBe('anthropic');
    expect(ws.selectedNotes).toEqual(['note-1', 'note-2']);
    expect(ws.pinnedTabs).toHaveLength(1);
    expect(ws.pinnedTabs[0].tabId).toBe(7);
  });

  it('setOpenedStandaloneTabId writes the active field and clears it on undefined', () => {
    useWorkspaceStore.setState({ workspace: freshWorkspace(), isReady: true });

    useWorkspaceStore.getState().setOpenedStandaloneTabId(42);
    expect(useWorkspaceStore.getState().workspace.openedStandaloneTabId).toBe(42);

    useWorkspaceStore.getState().setOpenedStandaloneTabId(undefined);
    expect(useWorkspaceStore.getState().workspace.openedStandaloneTabId).toBeUndefined();
  });

  it('chrome.storage.onChanged foreign write merges into state (version-LWW)', async () => {
    await useWorkspaceStore.getState().init();
    const localId = useWorkspaceStore.getState().workspace.workspaceId;
    // A foreign surface (the standalone view of the SAME workspace) writes a
    // HIGHER-version snapshot — the M.3 workspaceId gate (WR-10) requires the
    // workspaceId to match, so the LWW-adopt branch is what fires.
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: localId,
        conversationId: 'conv-foreign',
        activeSurface: 'standalone',
        version: 5,
        updatedAt: 5000,
      },
    });

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe(localId);
    expect(ws.conversationId).toBe('conv-foreign');
    expect(ws.activeSurface).toBe('standalone');
    expect(ws.version).toBe(5);
  });

  it('onChanged write from a foreign workspaceId is ignored (M.3 scope gate)', async () => {
    await useWorkspaceStore.getState().init();
    const localId = useWorkspaceStore.getState().workspace.workspaceId;
    const localConv = useWorkspaceStore.getState().workspace.conversationId;
    // Another window's workspace publishes a HIGHER-version snapshot — the M.3
    // workspaceId gate (WR-10) must reject it BEFORE version-LWW, exactly like
    // WorkspaceSync.handleRemoteUpdate (the two inbound paths agree).
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: 'ws-foreign',
        conversationId: 'conv-foreign',
        activeSurface: 'standalone',
        version: 99,
        updatedAt: 99000,
      },
    });

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe(localId);
    expect(ws.conversationId).toBe(localConv);
    expect(ws.version).toBe(0);
  });

  it('foreign write with equal/lower version is ignored (LWW)', async () => {
    await useWorkspaceStore.getState().init();
    const localId = useWorkspaceStore.getState().workspace.workspaceId;
    // A stale surface of the SAME workspace writes an OLDER snapshot (version 0
    // == local default version) — the M.3 gate passes, so the equal-version LWW
    // branch is what rejects it (WR-10 keeps this branch reachable).
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: localId,
        conversationId: 'conv-stale',
        activeSurface: 'sidepanel',
        version: 0,
        updatedAt: 100,
      },
    });

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe(localId);
    expect(ws.version).toBe(0);
  });

  it('malformed foreign storage is never merged (T-1-13)', async () => {
    await useWorkspaceStore.getState().init();
    const localId = useWorkspaceStore.getState().workspace.workspaceId;
    // Raw storage with a bad activeSurface + non-string workspaceId must be dropped.
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: 123,
        activeSurface: 'weird',
        version: 99,
        updatedAt: 1,
        evil: 'x',
      },
    });

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId).toBe(localId);
    expect(ws.activeSurface).toBe('sidepanel');
    expect(ws.version).toBe(0);
  });

  it('init failure falls back to defaults without throwing', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'get').mockRejectedValueOnce(new Error('storage boom'));

    await expect(useWorkspaceStore.getState().init()).resolves.toBeUndefined();

    const ws = useWorkspaceStore.getState().workspace;
    expect(ws.workspaceId.length).toBeGreaterThan(0);
    expect(ws.activeSurface).toBe('sidepanel');
    expect(useWorkspaceStore.getState().isReady).toBe(true);
  });

  it('star toggles persist through np_workspace (CR-01)', async () => {
    await useWorkspaceStore.getState().init();
    useWorkspaceStore.getState().toggleSelectedNote('note-a');

    // Journaled writes are async (`void journaledUpdateWorkspace`) — wait until
    // the stored np_workspace payload actually carries the star set.
    await vi.waitFor(async () => {
      const stored = (await fakeBrowser.storage.local.get(NP_WORKSPACE_KEY)) as Record<
        string,
        { selectedNotes?: string[] }
      >;
      expect(stored.np_workspace.selectedNotes).toEqual(['note-a']);
    });

    // Reload simulation: a fresh init must hydrate the star set from storage.
    resetStore();
    await useWorkspaceStore.getState().init();
    expect(useWorkspaceStore.getState().workspace.selectedNotes).toContain('note-a');
  });

  it('malformed selectedNotes in storage is never merged (T-1-13)', async () => {
    // Non-array shape — dropped.
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: 'ws-malformed-1',
        conversationId: 'conv-malformed-1',
        activeSurface: 'sidepanel',
        version: 3,
        updatedAt: 3000,
        selectedNotes: 'nope',
      },
    });
    await useWorkspaceStore.getState().init();
    expect(useWorkspaceStore.getState().workspace.selectedNotes).toEqual([]);

    // Array with non-string members — dropped.
    resetStore();
    await fakeBrowser.storage.local.set({
      np_workspace: {
        workspaceId: 'ws-malformed-2',
        conversationId: 'conv-malformed-2',
        activeSurface: 'sidepanel',
        version: 4,
        updatedAt: 4000,
        selectedNotes: [42],
      },
    });
    await useWorkspaceStore.getState().init();
    expect(useWorkspaceStore.getState().workspace.selectedNotes).toEqual([]);
  });
});
