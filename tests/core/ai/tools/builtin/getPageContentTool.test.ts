import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageContentTool } from '../../../../../src/core/ai/tools/builtin/getPageContentTool';
import { useWorkspaceStore } from '../../../../../src/core/stores/workspaceStore';
import { onDemandExtractor } from '../../../../../src/core/content/OnDemandExtractor';
import type { PageContext } from '../../../../../src/core/content/PageContext';

vi.mock('../../../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: { getState: vi.fn() },
}));

vi.mock('../../../../../src/core/content/OnDemandExtractor', () => ({
  onDemandExtractor: { extractFromTab: vi.fn() },
}));

const { mockGetForTabAsPageContext } = vi.hoisted(() => ({
  mockGetForTabAsPageContext: vi.fn(),
}));

vi.mock('../../../../../src/core/extraction/PageContentService', () => ({
  pageContentService: { getForTabAsPageContext: mockGetForTabAsPageContext },
}));

const mockTabsQuery = vi.fn();
vi.stubGlobal('chrome', {
  tabs: { query: mockTabsQuery, sendMessage: vi.fn() },
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
    extractionType: 'axdom',
    extractionQuality: 'tree',
    ...overrides,
  };
}

describe('getPageContentTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pinnedTabs: [],
      currentPageContext: null,
      pageContextByTab: {},
    });
    (onDemandExtractor.extractFromTab as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockGetForTabAsPageContext.mockRejectedValue(new Error('no content script'));
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

  it('throws AbortError when abortSignal is already aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      getPageContentTool.execute({}, { abortSignal: aborted.signal }),
    ).rejects.toThrow('Aborted');
  });

  it('returns cached PageContext when tabId matches a pinned tab', async () => {
    const cachedPage = makePageContext({ title: 'Cached Tab' });
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pinnedTabs: [
        { tabId: 42, windowId: 1, page: cachedPage, pinnedAt: Date.now(), active: true },
      ],
      currentPageContext: null,
      pageContextByTab: {},
    });

    const result = await getPageContentTool.execute(
      { tabId: 42 },
      { abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({ success: true, page: cachedPage });
  });

  it('returns per-tab cached PageContext when tabId is not pinned but cached', async () => {
    const cachedPage = makePageContext({ title: 'Cached-by-tab' });
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pinnedTabs: [],
      currentPageContext: null,
      pageContextByTab: { 7: { page: cachedPage, updatedAt: Date.now() } },
    });

    const result = await getPageContentTool.execute(
      { tabId: 7 },
      { abortSignal: new AbortController().signal },
    );

    expect(mockGetForTabAsPageContext).not.toHaveBeenCalled();
    expect(onDemandExtractor.extractFromTab).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, page: cachedPage });
  });

  it('uses PageContentService for fresh extraction when tabId is not cached', async () => {
    const freshPage = makePageContext({ title: 'Fresh Extraction' });
    mockGetForTabAsPageContext.mockResolvedValue(freshPage);

    const result = await getPageContentTool.execute(
      { tabId: 42 },
      { abortSignal: new AbortController().signal },
    );

    expect(mockGetForTabAsPageContext).toHaveBeenCalledWith(42);
    expect(result).toEqual({ success: true, page: freshPage });
  });

  it('falls back to OnDemandExtractor when PageContentService fails', async () => {
    const extractedPage = makePageContext({ title: 'On-demand Tab' });
    (onDemandExtractor.extractFromTab as ReturnType<typeof vi.fn>).mockResolvedValue(extractedPage);

    const result = await getPageContentTool.execute(
      { tabId: 8 },
      { abortSignal: new AbortController().signal },
    );

    expect(mockGetForTabAsPageContext).toHaveBeenCalledWith(8);
    expect(onDemandExtractor.extractFromTab).toHaveBeenCalledWith(8);
    expect(result).toEqual({ success: true, page: extractedPage });
  });

  it('returns error when all extraction paths fail for tabId', async () => {
    const result = await getPageContentTool.execute(
      { tabId: 999 },
      { abortSignal: new AbortController().signal },
    );

    expect(onDemandExtractor.extractFromTab).toHaveBeenCalledWith(999);
    expect(result).toEqual({
      success: false,
      error: 'Could not extract content for tab 999',
    });
  });

  it('uses PageContentService for the active tab when no tabId provided', async () => {
    const activePage = makePageContext({ title: 'Active Tab' });
    mockGetForTabAsPageContext.mockResolvedValue(activePage);
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: Array<{ id: number }>) => void) => {
      cb([{ id: 1 }]);
    });

    const result = await getPageContentTool.execute(
      {},
      { abortSignal: new AbortController().signal },
    );

    expect(mockGetForTabAsPageContext).toHaveBeenCalledWith(1);
    expect(result).toEqual({ success: true, page: activePage });
  });

  it('returns error when no active tab is available', async () => {
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: Array<unknown>) => void) => {
      cb([]);
    });

    const result = await getPageContentTool.execute(
      {},
      { abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({ success: false, error: 'No active tab' });
  });

  it('returns error when PageContentService fails for active tab', async () => {
    mockTabsQuery.mockImplementation((_query: unknown, cb: (tabs: Array<{ id: number }>) => void) => {
      cb([{ id: 1 }]);
    });

    const result = await getPageContentTool.execute(
      {},
      { abortSignal: new AbortController().signal },
    );

    expect(mockGetForTabAsPageContext).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      success: false,
      error: 'Could not extract content for active tab',
    });
  });

  it('returns cached PageContext for url lookup when pinned', async () => {
    const pinnedPage = makePageContext({ title: 'URL Match' });
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pinnedTabs: [
        { tabId: 1, windowId: 1, page: pinnedPage, pinnedAt: Date.now(), active: true, url: 'https://example.com' },
      ],
      currentPageContext: null,
      pageContextByTab: {},
    });

    const result = await getPageContentTool.execute(
      { url: 'https://example.com' },
      { abortSignal: new AbortController().signal },
    );

    expect(result).toEqual({ success: true, page: pinnedPage });
  });
});
