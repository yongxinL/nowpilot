import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { useThemeStore } from '../../src/core/stores/themeStore';

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

vi.mock('../../src/core/registries/FullAppPageRegistry', () => ({
  FullAppPageRegistry: class {
    pages = new Map();
    register(page: { id: string; label: string; component: React.ComponentType; order?: number }) {
      this.pages.set(page.id, page);
    }
    getAll() {
      return Array.from(this.pages.values());
    }
  },
  fullAppPageRegistry: {
    getAll: () => [
      { id: 'chat', label: 'Chat', component: () => React.createElement('div', null, 'Chat'), order: 1 },
      { id: 'agent', label: 'Agent', component: () => React.createElement('div', null, 'Agent'), order: 2 },
      { id: 'notes', label: 'Notes', component: () => React.createElement('div', null, 'Notes'), order: 3 },

    ],
    register: vi.fn(),
  },
}));

describe('THEME-04 — Theme propagates across surfaces via shared ThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'light' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    useThemeStore.setState({ mode: 'light' });
  });

  it('toggling theme in Side Panel via the shared store updates the Full App toggle label without re-render hand-off', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    render(React.createElement(SidePanelApp));

    const sidePanelBtn = (await screen.findAllByText('Light'))[0];
    expect(sidePanelBtn).toBeDefined();

    fireEvent.click(sidePanelBtn);

    expect(useThemeStore.getState().mode).toBe('dark');

    cleanup();

    const { FullAppApp } = await import('../../src/entrypoints/standalone/App');
    render(React.createElement(FullAppApp));

    const fullAppBtn = await screen.findByText('Dark');
    expect(fullAppBtn).toBeDefined();
  });

  it('reading theme mode in Full App reflects the value Side Panel last set (shared store proves cross-surface coupling)', async () => {
    useThemeStore.setState({ mode: 'dark' });

    const { FullAppApp } = await import('../../src/entrypoints/standalone/App');
    render(React.createElement(FullAppApp));

    const darkButton = await screen.findByText('Dark');
    expect(darkButton).toBeDefined();

    cleanup();

    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    render(React.createElement(SidePanelApp));

    const sideDarkBtn = await screen.findByText('Dark');
    expect(sideDarkBtn).toBeDefined();
  });

  it('mode cycle returns to auto after dark, matching the surface-local ModeCycle (cross-surface consistency)', async () => {
    useThemeStore.setState({ mode: 'auto' });

    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    render(React.createElement(SidePanelApp));

    const autoBtn = (await screen.findAllByText('Auto'))[0];
    fireEvent.click(autoBtn);
    expect(useThemeStore.getState().mode).toBe('light');

    fireEvent.click((await screen.findAllByText('Light'))[0]);
    expect(useThemeStore.getState().mode).toBe('dark');

    fireEvent.click((await screen.findAllByText('Dark'))[0]);
    expect(useThemeStore.getState().mode).toBe('auto');
  });
});
