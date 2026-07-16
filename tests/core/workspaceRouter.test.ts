import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openStandalone, getStandaloneUrl } from '../../src/core/routing/workspaceRouter';

const STANDALONE_URL: string = getStandaloneUrl();

describe('WorkspaceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('STANDALONE_URL is constructed via chrome.runtime.getURL', () => {
    expect(STANDALONE_URL).toBe('/standalone.html');
  });

  it('openStandalone calls chrome.tabs.query with the standalone url', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await openStandalone();
    expect(chrome.tabs.query).toHaveBeenCalledWith({ url: '/standalone.html' });
  });

  it('creates new tab when no existing tabs found', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await openStandalone();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: '/standalone.html' });
  });

  it('focuses existing tab instead of creating new one', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 42, windowId: 7 },
    ]);
    await openStandalone();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.update).toHaveBeenCalledWith(42, { active: true, url: '/standalone.html' });
    expect(chrome.windows.update).toHaveBeenCalledWith(7, { focused: true });
  });

  it('focuses first tab when multiple existing tabs found', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, windowId: 10 },
      { id: 2, windowId: 20 },
    ]);
    await openStandalone();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true, url: '/standalone.html' });
  });

  it('handles tab without id gracefully', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { windowId: 5 },
    ]);
    await openStandalone();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: '/standalone.html' });
  });
});
