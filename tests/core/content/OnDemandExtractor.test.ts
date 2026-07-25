/**
 * Tests for OnDemandExtractor.
 *
 * 1. Live message succeeds → returns page, never injects.
 * 2. Live message fails → injects → cache update arrives → resolves with page.
 * 3. Live message fails → injection throws (restricted tab) → resolves null.
 * 4. Live message fails → injects → cache never updates → times out → resolves null.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnDemandExtractor } from '../../../src/core/content/OnDemandExtractor';
import { useWorkspaceStore } from '../../../src/core/stores/workspaceStore';
import type { PageContext } from '../../../src/core/content/PageContext';

// ---- Mock workspaceStore ----
let mockPageContextByTab: Record<number, { page: PageContext; updatedAt: number }> = {};
const subscribers: Array<(state: { pageContextByTab: typeof mockPageContextByTab }) => void> = [];

vi.mock('../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: vi.fn(() => ({ pageContextByTab: mockPageContextByTab })),
    subscribe: vi.fn((listener: (state: { pageContextByTab: typeof mockPageContextByTab }) => void) => {
      subscribers.push(listener);
      return () => {
        const idx = subscribers.indexOf(listener);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    }),
  },
}));

function pushCacheUpdate(tabId: number, page: PageContext, updatedAt = Date.now()) {
  mockPageContextByTab = { ...mockPageContextByTab, [tabId]: { page, updatedAt } };
  subscribers.forEach((fn) => fn({ pageContextByTab: mockPageContextByTab }));
}

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

// ---- Mock chrome ----
const mockSendMessage = vi.fn();
const mockExecuteScript = vi.fn();

vi.stubGlobal('chrome', {
  tabs: { sendMessage: mockSendMessage },
  scripting: { executeScript: mockExecuteScript },
  runtime: { lastError: undefined as { message: string } | undefined },
});

describe('OnDemandExtractor', () => {
  let extractor: OnDemandExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    subscribers.length = 0;
    mockPageContextByTab = {};
    chrome.runtime.lastError = undefined;
    extractor = new OnDemandExtractor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the page directly when the live content script responds', async () => {
    const page = makePageContext({ title: 'Live Tab' });
    mockSendMessage.mockImplementation((_tabId, _msg, cb) => cb({ success: true, page }));

    const result = await extractor.extractFromTab(1);

    expect(result).toEqual(page);
    expect(mockExecuteScript).not.toHaveBeenCalled();
  });

  it('injects the content-script bundle and resolves once the cache updates', async () => {
    mockSendMessage.mockImplementation((_tabId, _msg, cb) => {
      chrome.runtime.lastError = { message: 'Could not establish connection' };
      cb(undefined);
    });
    mockExecuteScript.mockResolvedValue(undefined);

    const page = makePageContext({ title: 'Injected Tab' });
    const promise = extractor.extractFromTab(2);
    // Simulate the re-injected content script pushing PAGE_CONTEXT_UPDATED.
    pushCacheUpdate(2, page);

    const result = await promise;

    expect(mockExecuteScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 2 }, files: ['content-scripts/content.js'] }),
    );
    expect(result).toEqual(page);
  });

  it('returns null when injection fails (restricted tab)', async () => {
    mockSendMessage.mockImplementation((_tabId, _msg, cb) => {
      chrome.runtime.lastError = { message: 'Could not establish connection' };
      cb(undefined);
    });
    mockExecuteScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));

    const result = await extractor.extractFromTab(3);

    expect(result).toBeNull();
  });

  it('times out and returns null when the cache never updates', async () => {
    vi.useFakeTimers();
    mockSendMessage.mockImplementation((_tabId, _msg, cb) => {
      chrome.runtime.lastError = { message: 'Could not establish connection' };
      cb(undefined);
    });
    mockExecuteScript.mockResolvedValue(undefined);

    const promise = extractor.extractFromTab(4);
    await vi.advanceTimersByTimeAsync(3100);

    expect(await promise).toBeNull();
  });
});
