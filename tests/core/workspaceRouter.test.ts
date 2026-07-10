import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openFullApp, getFullAppUrl } from '../../src/core/routing/workspaceRouter';

const FULL_APP_URL: string = getFullAppUrl();

describe('WorkspaceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FULL_APP_URL is constructed via chrome.runtime.getURL', () => {
    expect(FULL_APP_URL).toBe('/standalone.html');
  });

  it('openFullApp calls chrome.tabs.query with the full app url', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await openFullApp();
    expect(chrome.tabs.query).toHaveBeenCalledWith({ url: '/standalone.html' });
  });

  it('creates new tab when no existing tabs found', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await openFullApp();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: '/standalone.html' });
  });

  it('focuses existing tab instead of creating new one', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 42, windowId: 7 },
    ]);
    await openFullApp();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.update).toHaveBeenCalledWith(42, { active: true });
    expect(chrome.windows.update).toHaveBeenCalledWith(7, { focused: true });
  });

  it('focuses first tab when multiple existing tabs found', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, windowId: 10 },
      { id: 2, windowId: 20 },
    ]);
    await openFullApp();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
  });

  it('handles tab without id gracefully', async () => {
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([
      { windowId: 5 },
    ]);
    await openFullApp();
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: '/standalone.html' });
  });
});
