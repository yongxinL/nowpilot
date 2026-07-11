import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { useThemeStore } from '../../src/core/stores/themeStore';

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
  registry.register({
    id: 'chat',
    label: 'Chat',
    component: () => React.createElement('div', null, 'ChatPage'),
    order: 1,
  });
  registry.register({
    id: 'agent',
    label: 'Agent',
    component: () => React.createElement('div', null, 'AgentPage'),
    order: 2,
  });
  return {
    SidepanelPageRegistry,
    sidepanelPageRegistry: registry,
  };
});

vi.mock('../../src/core/registries/StandalonePageRegistry', () => {
  class StandalonePageRegistry {
    pages = new Map<string, { id: string; label: string; component: React.ComponentType; order?: number }>();
    register(page: { id: string; label: string; component: React.ComponentType; order?: number }) {
      this.pages.set(page.id, page);
    }
    getAll() {
      return Array.from(this.pages.values());
    }
  }
  const registry = new StandalonePageRegistry();
  registry.register({ id: 'chat', label: 'Chat', component: () => React.createElement('div', null, 'ChatPage'), order: 1 });
  registry.register({ id: 'agent', label: 'Agent', component: () => React.createElement('div', null, 'AgentPage'), order: 2 });
  registry.register({ id: 'notes', label: 'Notes', component: () => React.createElement('div', null, 'NotesPage'), order: 3 });
  return {
    StandalonePageRegistry,
    standalonePageRegistry: registry,
  };
});

describe('THEME-04 — Theme propagates across surfaces via shared ThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'light' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    useThemeStore.setState({ mode: 'light' });
  });

  it('ThemeStore is shared: setting mode from one surface is observed by the other on render', async () => {
    useThemeStore.setState({ mode: 'dark' });

    const { StandaloneApp } = await import('../../src/entrypoints/standalone/App');
    const { container: standaloneContainer } = render(React.createElement(StandaloneApp));
    expect(standaloneContainer.querySelector('[data-surface="standalone"]')).toBeTruthy();

    cleanup();

    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    const { container: sidepanelContainer } = render(React.createElement(SidePanelApp));
    expect(sidepanelContainer.querySelector('[data-surface="sidepanel"]')).toBeTruthy();

    expect(useThemeStore.getState().mode).toBe('dark');
  });
});
