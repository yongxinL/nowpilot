/**
 * Tests for searchTabsTool.
 *
 * 1. Metadata (name/category/requiresPermission)
 * 2. abortSignal.aborted → throws AbortError
 * 3. chrome.tabs.query failure → { success: false, error }
 * 4. Title match → matchedBy: 'title', snippet from cached page content
 * 5. URL match (no title match) → matchedBy: 'url'
 * 6. Content-only match (no title/url match, found via cached content) → matchedBy: 'content'
 * 7. Uncached candidate tab falls back to OnDemandExtractor
 * 8. limit caps the result count
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchTabsTool } from '../../../../../src/core/ai/tools/builtin/searchTabsTool';
import { useWorkspaceStore } from '../../../../../src/core/stores/workspaceStore';
import { onDemandExtractor } from '../../../../../src/core/content/OnDemandExtractor';
import type { PageContext } from '../../../../../src/core/content/PageContext';

vi.mock('../../../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: { getState: vi.fn() },
}));

vi.mock('../../../../../src/core/content/OnDemandExtractor', () => ({
  onDemandExtractor: { extractFromTab: vi.fn() },
}));

const mockTabsQuery = vi.fn();
vi.stubGlobal('chrome', {
  tabs: { query: mockTabsQuery },
});

function makeTab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 1,
    windowId: 1,
    title: 'Untitled',
    url: 'https://example.com',
    ...overrides,
  } as chrome.tabs.Tab;
}

function makePage(markdown: string, overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Page',
    markdown,
    meta: {},
    extractedAt: Date.now(),
    extractionType: 'readability',
    extractionQuality: 'article',
    ...overrides,
  };
}

describe('searchTabsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pageContextByTab: {},
    });
    (onDemandExtractor.extractFromTab as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('has correct metadata', () => {
    expect(searchTabsTool.name).toBe('search-tabs');
    expect(searchTabsTool.category).toBe('safe');
    expect(searchTabsTool.requiresPermission).toBe(false);
  });

  it('throws AbortError when abortSignal is already aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      searchTabsTool.execute({ query: 'foo' }, { abortSignal: aborted.signal }),
    ).rejects.toThrow('Aborted');
  });

  it('returns an error when chrome.tabs.query fails', async () => {
    mockTabsQuery.mockRejectedValue(new Error('tabs unavailable'));

    const result = (await searchTabsTool.execute(
      { query: 'foo' },
      { abortSignal: new AbortController().signal },
    )) as { success: boolean; error?: string };

    expect(result.success).toBe(false);
    expect(result.error).toContain('tabs unavailable');
  });

  it('matches by title and includes cached content as the snippet', async () => {
    const tab = makeTab({ id: 1, title: 'ServiceNow Incident Queue', url: 'https://sn.example.com' });
    mockTabsQuery.mockResolvedValue([tab]);
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pageContextByTab: { 1: { page: makePage('Incident details here'), updatedAt: Date.now() } },
    });

    const result = (await searchTabsTool.execute(
      { query: 'incident queue' },
      { abortSignal: new AbortController().signal },
    )) as { success: boolean; results: Array<{ tabId: number; matchedBy: string; snippet: string }> };

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ tabId: 1, matchedBy: 'title' });
    expect(result.results[0].snippet).toContain('Incident details here');
    expect(onDemandExtractor.extractFromTab).not.toHaveBeenCalled();
  });

  it('matches by URL when the title does not match', async () => {
    const tab = makeTab({ id: 2, title: 'Dashboard', url: 'https://example.com/incident/42' });
    mockTabsQuery.mockResolvedValue([tab]);

    const result = (await searchTabsTool.execute(
      { query: 'incident' },
      { abortSignal: new AbortController().signal },
    )) as { success: boolean; results: Array<{ tabId: number; matchedBy: string }> };

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ tabId: 2, matchedBy: 'url' });
  });

  it('falls back to content-only matches when nothing matches by title/url', async () => {
    const tabs = [
      makeTab({ id: 3, title: 'Blank Tab', url: 'https://blank.example.com' }),
      makeTab({ id: 4, title: 'Another Tab', url: 'https://other.example.com' }),
    ];
    mockTabsQuery.mockResolvedValue(tabs);
    (useWorkspaceStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      pageContextByTab: {
        3: { page: makePage('nothing relevant'), updatedAt: Date.now() },
        4: { page: makePage('the widget rollout postmortem'), updatedAt: Date.now() },
      },
    });

    const result = (await searchTabsTool.execute(
      { query: 'postmortem' },
      { abortSignal: new AbortController().signal },
    )) as { success: boolean; results: Array<{ tabId: number; matchedBy: string }> };

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ tabId: 4, matchedBy: 'content' });
  });

  it('extracts uncached candidate tabs via OnDemandExtractor', async () => {
    const tab = makeTab({ id: 5, title: 'Report', url: 'https://report.example.com' });
    mockTabsQuery.mockResolvedValue([tab]);
    (onDemandExtractor.extractFromTab as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePage('quarterly numbers'),
    );

    const result = (await searchTabsTool.execute(
      { query: 'quarterly' },
      { abortSignal: new AbortController().signal },
    )) as { success: boolean; results: Array<{ tabId: number; matchedBy: string }> };

    expect(onDemandExtractor.extractFromTab).toHaveBeenCalledWith(5);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ tabId: 5, matchedBy: 'content' });
  });

  it('caps results at the requested limit', async () => {
    const tabs = Array.from({ length: 5 }, (_, i) =>
      makeTab({ id: i + 1, title: `Incident Report ${i}`, url: `https://example.com/${i}` }),
    );
    mockTabsQuery.mockResolvedValue(tabs);

    const result = (await searchTabsTool.execute(
      { query: 'incident', limit: 2 },
      { abortSignal: new AbortController().signal },
    )) as { success: boolean; results: unknown[] };

    expect(result.results).toHaveLength(2);
  });
});
