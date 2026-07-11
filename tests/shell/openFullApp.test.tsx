import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useThemeStore } from '../../src/core/stores/themeStore';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';
import { getStandaloneUrl } from '../../src/core/routing/workspaceRouter';

vi.mock('../../src/core/registries/SidepanelPageRegistry', () => {
  class SidepanelPageRegistry {
    pages = new Map<string, { id: string; label: string; component: React.ComponentType; order?: number }>();
    register(page: { id: string; label: string; component: React.ComponentType; order?: number }) {
      this.pages.set(page.id, page);
    }
    getAll() {
      return Array.from(this.pages.values());
    }
  }
  const registry = new SidepanelPageRegistry();
  registry.register({ id: 'chat', label: 'Chat', component: () => React.createElement('div', null, 'ChatPage'), order: 1 });
  registry.register({ id: 'agent', label: 'Agent', component: () => React.createElement('div', null, 'AgentPage'), order: 2 });
  return { SidepanelPageRegistry, sidepanelPageRegistry: registry };
});

const STANDALONE_URL: string = getStandaloneUrl();

function findAllByLabelText(container: HTMLElement, text: string): HTMLElement[] {
  return Array.from(container.querySelectorAll('[aria-label]')).filter(
    (el) => el.getAttribute('aria-label') === text,
  ) as HTMLElement[];
}

describe('SHELL-05 — "Open Standalone" action in Side Panel', () => {
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

  it('clicking the "Open Standalone" button calls chrome.tabs.create with the standalone URL', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    const { container } = render(React.createElement(SidePanelApp));

    const openButtons = findAllByLabelText(container, 'Open Standalone');
    expect(openButtons.length).toBeGreaterThan(0);

    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: STANDALONE_URL }),
      );
    });
    expect(STANDALONE_URL).toContain('standalone.html');
  });

  it('action is wired through openStandalone() (single workspace handoff source of truth)', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    const { container } = render(React.createElement(SidePanelApp));

    (chrome.tabs.create as ReturnType<typeof vi.fn>).mockClear();

    const openButton = findAllByLabelText(container, 'Open Standalone')[0];
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    });
  });
});
