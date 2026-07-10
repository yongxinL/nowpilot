import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
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
    expect(container.querySelector('.ant-layout')).toBeDefined();
  });

  it('theme toggle button is present in Side Panel', async () => {
    const { SidePanelApp } = await import('../../src/entrypoints/sidepanel/App');
    const { findByText } = render(React.createElement(SidePanelApp));
    const btn = await findByText('Auto');
    expect(btn).toBeDefined();
  });

  it('renders FullAppApp without crashing', async () => {
    const { FullAppApp } = await import('../../src/entrypoints/standalone/App');
    const { container } = render(React.createElement(FullAppApp));
    expect(container.querySelector('.ant-layout')).toBeDefined();
  });

  it('renders PopupApp without crashing', async () => {
    const { PopupApp } = await import('../../src/entrypoints/popup/App');
    const { findByText } = render(React.createElement(PopupApp));
    const title = await findByText('NowPilot');
    expect(title).toBeDefined();
  });
});
