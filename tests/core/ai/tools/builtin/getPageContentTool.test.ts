/**
 * Tests for getPageContentTool — MCP tool #1.
 *
 * Tests 6 behaviors per PLAN.md Task 3:
 * 1. No tabId → queries active tab, sends GET_PAGE_CONTEXT_REQUEST, returns fresh result
 * 2. tabId provided → looks up pinned tab in workspaceStore, returns cached PageContext
 * 3. tabId not found in pinned tabs → returns { success: false, error }
 * 4. abortSignal.aborted → throws AbortError
 * 5. No active tab → returns { success: false, error: 'No active tab' }
 * 6. chrome.runtime.lastError after sendMessage → returns error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageContentTool } from '../../../../../src/core/ai/tools/builtin/getPageContentTool';
import { useWorkspaceStore } from '../../../../../src/core/stores/workspaceStore';
import type { PageContext } from '../../../../../src/core/content/PageContext';

// ---- Mock workspaceStore ----
vi.mock('../../../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: vi.fn(),
  },
}));

// ---- Mock chrome.tabs ----
const mockTabsQuery = vi.fn();
const mockTabsSendMessage = vi.fn();

vi.stubGlobal('chrome', {
  tabs: {
    query: mockTabsQuery,
    sendMessage: mockTabsSendMessage,
  },
  runtime: {
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
});

function makePageContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Example Page',
    markdown: '# Hello',
    meta: {},
    extractedAt: Date.now(),
    extractionType: 'readability',
    extractionQuality: 'article',
    ...overrides,
  };
}

describe('getPageContentTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = undefined;
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pinnedTabs: [],
      currentPageContext: null,
    });
  });

  it('has correct metadata', () => {
    expect(getPageContentTool.name).toBe('get-page-content');
    expect(getPageContentTool.category).toBe('safe');
    expect(getPageContentTool.requiresPermission).toBe(false);
  });

  it('inputSchema accepts optional tabId', () => {
    const r1 = getPageContentTool.inputSchema.safeParse({});
    expect(r1.success).toBe(true);
    const r2 = getPageContentTool.inputSchema.safeParse({ tabId: 42 });
    expect(r2.success).toBe(true);
  });

  it('inputSchema rejects invalid input', () => {
    const r = getPageContentTool.inputSchema.safeParse({ tabId: 'not-a-number' });
    expect(r.success).toBe(false);
  });

  // Behavior 4: abortSignal.aborted → throws AbortError
  it('throws AbortError when abortSignal is already aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      getPageContentTool.execute({}, { abortSignal: aborted.signal }),
    ).rejects.toThrow('Aborted');
  });

  // Behavior 1: No tabId → queries active tab, sends GET_PAGE_CONTEXT_REQUEST
  it('queries active tab and sends extraction request when no tabId provided', async () => {
    const mockPageContext = makePageContext();
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: Array<{ id: number }>) => void) => {
      cb([{ id: 1 }]);
    });
    mockTabsSendMessage.mockImplementation(
      (_tabId: number, _msg: unknown, cb: (response: unknown) => void) => {
        cb({ success: true, pageContext: mockPageContext });
      },
    );

    const result = await getPageContentTool.execute(
      {},
      { abortSignal: new AbortController().signal },
    );

    expect(mockTabsQuery).toHaveBeenCalled();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      1,
      { type: 'GET_PAGE_CONTEXT_REQUEST' },
      expect.any(Function),
    );
    expect(result).toEqual({ success: true, pageContext: mockPageContext });
  });

  // Behavior 2: tabId provided → looks up pinned tab in workspaceStore
  it('returns cached PageContext when tabId matches a pinned tab (D-20)', async () => {
    const cachedPage = makePageContext({ title: 'Cached Tab' });
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pinnedTabs: [
        { tabId: 42, windowId: 1, page: cachedPage, pinnedAt: Date.now(), active: true },
      ],
      currentPageContext: null,
    });

    const result = await getPageContentTool.execute(
      { tabId: 42 },
      { abortSignal: new AbortController().signal },
    );

    expect(mockTabsQuery).not.toHaveBeenCalled(); // Should NOT query tabs
    expect(result).toEqual({ success: true, page: cachedPage });
  });

  // Behavior 3: tabId not found in pinned tabs
  it('returns error when tabId is not found in pinned tabs', async () => {
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pinnedTabs: [],
      currentPageContext: null,
    });

    const result = await getPageContentTool.execute(
      { tabId: 999 },
      { abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({
      success: false,
      error: 'Pinned tab 999 not found',
    });
  });

  // Behavior 5: No active tab
  it('returns error when no active tab is available', async () => {
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: Array<{ id: number }>) => void) => {
      cb([]); // No tabs
    });

    const result = await getPageContentTool.execute(
      {},
      { abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({ success: false, error: 'No active tab' });
  });

  // Behavior 6: chrome.runtime.lastError after sendMessage
  it('returns error when chrome.runtime.lastError is set after sendMessage', async () => {
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: Array<{ id: number }>) => void) => {
      cb([{ id: 1 }]);
    });
    mockTabsSendMessage.mockImplementation(
      (_tabId: number, _msg: unknown, cb: (response: unknown) => void) => {
        chrome.runtime.lastError = { message: 'Could not establish connection' } as chrome.runtime.LastError;
        cb(undefined);
      },
    );

    const result = await getPageContentTool.execute(
      {},
      { abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({
      success: false,
      error: 'Could not establish connection',
    });
    chrome.runtime.lastError = undefined;
  });

  // Edge: no response from content script
  it('returns error when content script returns no response', async () => {
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: Array<{ id: number }>) => void) => {
      cb([{ id: 1 }]);
    });
    mockTabsSendMessage.mockImplementation(
      (_tabId: number, _msg: unknown, cb: (response: unknown) => void) => {
        cb(undefined); // No response
      },
    );

    const result = await getPageContentTool.execute(
      {},
      { abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({
      success: false,
      error: 'No response from content script',
    });
  });
});
