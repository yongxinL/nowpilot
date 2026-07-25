import { describe, it, expect, vi, beforeEach } from 'vitest';
import backgroundEntry from '../../src/entrypoints/background';
import type { BackgroundDefinition } from 'wxt';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';
import { PAGE_CONTEXT_UPDATED } from '../../src/core/messaging/pageMessages';
import type { PageContext } from '../../src/core/content/PageContext';

function makePageContext(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Example',
    markdown: '# Hello',
    meta: {},
    extractedAt: Date.now(),
    extractionType: 'readability',
    extractionQuality: 'article',
    ...overrides,
  };
}

describe('Background SW', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({ pageContextByTab: {}, currentPageContext: null });
  });

  it('exports a valid BackgroundDefinition', () => {
    expect(backgroundEntry).toBeDefined();
    expect(typeof (backgroundEntry as BackgroundDefinition).main).toBe('function');
  });

  it('main() callback is NOT an async function', () => {
    const result = (backgroundEntry as BackgroundDefinition).main();
    expect(result).toBeUndefined();
  });

  it('registers chrome.runtime.onInstalled.addListener when main() runs', () => {
    (backgroundEntry as BackgroundDefinition).main();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
  });

  it('registers all three chrome listeners when main() runs', () => {
    (backgroundEntry as BackgroundDefinition).main();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(chrome.commands.onCommand.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('onMessage handler returns true to keep channel open', () => {
    (backgroundEntry as BackgroundDefinition).main();
    const onMessageHandler = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const result = onMessageHandler({ type: 'test' }, { tab: { id: 1 } }, () => {});
    expect(result).toBe(true);
  });

  it('registers chrome.tabs.onRemoved.addListener when main() runs', () => {
    (backgroundEntry as BackgroundDefinition).main();
    expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
  });

  it('PAGE_CONTEXT_UPDATED caches the page keyed by sender.tab.id', () => {
    (backgroundEntry as BackgroundDefinition).main();
    const onMessageHandler = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const page = makePageContext({ title: 'Tab 7' });
    const sendResponse = vi.fn();

    onMessageHandler(
      { type: PAGE_CONTEXT_UPDATED, source: 'content-script', payload: page },
      { tab: { id: 7 } },
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledWith({ success: true });
    expect(useWorkspaceStore.getState().pageContextByTab[7]?.page).toEqual(page);
    // The single-slot convenience field is still updated for back-compat.
    expect(useWorkspaceStore.getState().currentPageContext).toEqual(page);
  });

  it('does not cross-contaminate two tabs pushing PAGE_CONTEXT_UPDATED', () => {
    (backgroundEntry as BackgroundDefinition).main();
    const onMessageHandler = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const pageA = makePageContext({ title: 'Tab A' });
    const pageB = makePageContext({ title: 'Tab B' });

    onMessageHandler(
      { type: PAGE_CONTEXT_UPDATED, source: 'content-script', payload: pageA },
      { tab: { id: 1 } },
      vi.fn(),
    );
    onMessageHandler(
      { type: PAGE_CONTEXT_UPDATED, source: 'content-script', payload: pageB },
      { tab: { id: 2 } },
      vi.fn(),
    );

    expect(useWorkspaceStore.getState().pageContextByTab[1]?.page.title).toBe('Tab A');
    expect(useWorkspaceStore.getState().pageContextByTab[2]?.page.title).toBe('Tab B');
  });

  it('PAGE_CONTEXT_UPDATED without sender.tab.id skips the per-tab cache', () => {
    (backgroundEntry as BackgroundDefinition).main();
    const onMessageHandler = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const page = makePageContext();

    onMessageHandler(
      { type: PAGE_CONTEXT_UPDATED, source: 'content-script', payload: page },
      {},
      vi.fn(),
    );

    expect(useWorkspaceStore.getState().pageContextByTab).toEqual({});
    expect(useWorkspaceStore.getState().currentPageContext).toEqual(page);
  });

  it('chrome.tabs.onRemoved callback clears that tab from the cache', () => {
    (backgroundEntry as BackgroundDefinition).main();
    useWorkspaceStore.getState().setPageContextForTab(3, makePageContext());
    expect(useWorkspaceStore.getState().pageContextByTab[3]).toBeDefined();

    const onRemovedHandler = (chrome.tabs.onRemoved.addListener as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    onRemovedHandler(3);

    expect(useWorkspaceStore.getState().pageContextByTab[3]).toBeUndefined();
  });
});
