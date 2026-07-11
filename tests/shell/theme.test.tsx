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
  registry.register({ id: 'chat', label: 'Chat', component: () => React.createElement('div', null, 'ChatPage'), order: 1 });
  registry.register({ id: 'agent', label: 'Agent', component: () => React.createElement('div', null, 'AgentPage'), order: 2 });
  return { SidepanelPageRegistry, sidepanelPageRegistry: registry };
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
  return { StandalonePageRegistry, standalonePageRegistry: registry };
});

describe('Shell Theme Integration', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'auto' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders SidePanelApp without crashing', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    const { container } = render(React.createElement(SidePanelApp));
    expect(container.querySelector('[data-surface="sidepanel"]')).toBeTruthy();
  });

  it('Side Panel renders an Open Standalone action', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    const { findAllByLabelText, findByLabelText } = render(React.createElement(SidePanelApp));
    const expandOrOpen = await Promise.race([
      findAllByLabelText('Open Standalone').then((r) => r[0]).catch(() => null),
      findByLabelText('Open Standalone').catch(() => null),
    ]);
    expect(expandOrOpen).toBeTruthy();
  });

  it('renders StandaloneApp without crashing', async () => {
    const { StandaloneApp } = await import('../../src/entrypoints/standalone/App');
    const { container } = render(React.createElement(StandaloneApp));
    expect(container.querySelector('[data-surface="standalone"]')).toBeTruthy();
  });

  it('renders PopupApp without crashing', async () => {
    const { PopupApp } = await import('../../src/entrypoints/popup/App');
    const { findByText } = render(React.createElement(PopupApp));
    const title = await findByText('NowPilot');
    expect(title).toBeDefined();
  });
});
