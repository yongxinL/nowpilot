import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useThemeStore } from '../../src/core/stores/themeStore';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';
import { getFullAppUrl } from '../../src/core/routing/workspaceRouter';

vi.mock('../../src/core/registries/SidePanelPageRegistry', () => ({
  SidePanelPageRegistry: class {
    pages = new Map();
    register(page: { id: string; label: string; component: React.ComponentType; order?: number }) {
      this.pages.set(page.id, page);
    }
    getAll() {
      return Array.from(this.pages.values());
    }
  },
  sidePanelPageRegistry: {
    getAll: () => [
      { id: 'chat', label: 'Chat', component: () => React.createElement('div', null, 'Chat'), order: 1 },
      { id: 'agent', label: 'Agent', component: () => React.createElement('div', null, 'Agent'), order: 2 },
    ],
    register: vi.fn(),
  },
}));

const FULL_APP_URL: string = getFullAppUrl();

describe('SHELL-05 — "Open Full App" button in Side Panel', () => {
  beforeEach(async () => {
    useThemeStore.setState({ mode: 'auto' });
    useWorkspaceStore.setState({
      workspaceId: null,
      conversationId: null,
      activeProvider: 'openai',
      activeSurface: 'sidepanel',
    });
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (chrome.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('clicking the "Open Full App" button calls chrome.tabs.create with the Full App URL', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    render(React.createElement(SidePanelApp));

    const openButtons = await screen.findAllByText('Open Full App');
    expect(openButtons.length).toBeGreaterThan(0);

    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: FULL_APP_URL }),
      );
    });
    expect(FULL_APP_URL).toContain('app.html');
  });

  it('button is wired through openFullApp() (single workspace handoff source of truth)', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    render(React.createElement(SidePanelApp));

    (chrome.tabs.create as ReturnType<typeof vi.fn>).mockClear();

    const openButton = (await screen.findAllByText('Open Full App'))[0];
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    });
  });
});
