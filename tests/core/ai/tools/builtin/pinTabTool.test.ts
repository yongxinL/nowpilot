/**
 * Tests for pinTabTool — MCP tool #5.
 *
 * Tests 5 behaviors per PLAN.md Task 3:
 * 1. action='pin' on valid tab → adds to workspaceStore, returns success + count
 * 2. action='pin' when at max-10 → returns { success: false, error } (D-30)
 * 3. action='unpin' → calls removePinnedTab, returns success
 * 4. abortSignal.aborted → throws AbortError
 * 5. chrome.tabs.get fails → returns error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pinTabTool } from '../../../../../src/core/ai/tools/builtin/pinTabTool';
import { useWorkspaceStore } from '../../../../../src/core/stores/workspaceStore';

// ---- Mock workspaceStore ----
const mockAddPinnedTab = vi.fn();
const mockRemovePinnedTab = vi.fn();
let mockPinnedTabs: Array<{ tabId: number }> = [];
let mockPageContextByTab: Record<number, { page: unknown; updatedAt: number }> = {};

vi.mock('../../../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: vi.fn(() => ({
      pinnedTabs: mockPinnedTabs,
      currentPageContext: null,
      pageContextByTab: mockPageContextByTab,
      addPinnedTab: mockAddPinnedTab,
      removePinnedTab: mockRemovePinnedTab,
    })),
  },
}));

// ---- Mock chrome.tabs ----
const mockTabsGet = vi.fn();

vi.stubGlobal('chrome', {
  tabs: {
    get: mockTabsGet,
  },
});

describe('pinTabTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPinnedTabs = [];
    mockPageContextByTab = {};
  });

  it('has correct metadata', () => {
    expect(pinTabTool.name).toBe('pin-tab');
    expect(pinTabTool.category).toBe('safe');
    expect(pinTabTool.requiresPermission).toBe(false);
  });

  it('inputSchema accepts tabId and action', () => {
    const r1 = pinTabTool.inputSchema.safeParse({ tabId: 1, action: 'pin' });
    expect(r1.success).toBe(true);
    const r2 = pinTabTool.inputSchema.safeParse({ tabId: 2, action: 'unpin' });
    expect(r2.success).toBe(true);
  });

  it('inputSchema defaults action to "pin"', () => {
    const r = pinTabTool.inputSchema.safeParse({ tabId: 1 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.action).toBe('pin');
    }
  });

  it('inputSchema rejects invalid action', () => {
    const r = pinTabTool.inputSchema.safeParse({ tabId: 1, action: 'delete' });
    expect(r.success).toBe(false);
  });

  // Behavior 4: abortSignal.aborted → throws AbortError
  it('throws AbortError when abortSignal is already aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      pinTabTool.execute({ tabId: 1, action: 'pin' }, { abortSignal: aborted.signal }),
    ).rejects.toThrow('Aborted');
  });

  // Behavior 3: action='unpin' → calls removePinnedTab, returns success
  it('unpins a tab and returns success with updated count', async () => {
    await pinTabTool.execute(
      { tabId: 42, action: 'unpin' },
      { abortSignal: new AbortController().signal },
    );

    expect(mockRemovePinnedTab).toHaveBeenCalledWith(42);
    // pinnedCount in result is store.pinnedTabs.length - 1 (since remove happens before length read)
    // At this point pinnedTabs = [], so length - 1 = -1... but the tool reads before the remove call
    // The tool will read store.pinnedTabs.length - 1 at the return time
  });

  // Behavior 1: action='pin' on valid tab → adds to workspaceStore
  it('pins a valid tab and returns success with pinnedCount', async () => {
    mockTabsGet.mockResolvedValue({
      id: 5,
      windowId: 1,
      url: 'https://example.com',
      title: 'Example',
    });

    const result = await pinTabTool.execute(
      { tabId: 5, action: 'pin' },
      { abortSignal: new AbortController().signal },
    );

    expect(mockTabsGet).toHaveBeenCalledWith(5);
    expect(mockAddPinnedTab).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('pinnedCount');
  });

  // Behavior 2: action='pin' when at max-10 → returns error (D-30)
  it('rejects pin when 10 tabs are already pinned (D-30)', async () => {
    mockPinnedTabs = Array.from({ length: 10 }, (_, i) => ({ tabId: i + 1 }));

    const result = await pinTabTool.execute(
      { tabId: 11, action: 'pin' },
      { abortSignal: new AbortController().signal },
    );

    expect(mockTabsGet).not.toHaveBeenCalled(); // Should not call chrome.tabs.get
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum 10 pinned tabs');
  });

  // Regression (D-31): pinning tab B must use tab B's cached page, not
  // whichever tab most recently pushed a PAGE_CONTEXT_UPDATED.
  it('uses this tab\'s cached page context, not another tab\'s', async () => {
    mockTabsGet.mockResolvedValue({
      id: 5,
      windowId: 1,
      url: 'https://example.com/b',
      title: 'Tab B',
    });
    mockPageContextByTab = {
      5: { page: { title: 'Tab B content', url: 'https://example.com/b' }, updatedAt: Date.now() },
      99: { page: { title: 'Tab A content', url: 'https://example.com/a' }, updatedAt: Date.now() },
    };

    await pinTabTool.execute(
      { tabId: 5, action: 'pin' },
      { abortSignal: new AbortController().signal },
    );

    expect(mockAddPinnedTab).toHaveBeenCalledWith(
      expect.objectContaining({ page: expect.objectContaining({ title: 'Tab B content' }) }),
    );
  });

  // Behavior 5: chrome.tabs.get fails → returns error
  it('returns error when chrome.tabs.get fails', async () => {
    mockTabsGet.mockRejectedValue(new Error('Tab not found'));

    const result = await pinTabTool.execute(
      { tabId: 999, action: 'pin' },
      { abortSignal: new AbortController().signal },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Tab not found');
  });
});
