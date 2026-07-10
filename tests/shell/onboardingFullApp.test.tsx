import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { useThemeStore } from '../../src/core/stores/themeStore';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';

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
      { id: 'options', label: 'Options', component: () => React.createElement('div', null, 'Options'), order: 4 },
    ],
    register: vi.fn(),
  },
}));

describe('ONBD-03 — Onboarding available on Full App surface', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'auto' });
    useWorkspaceStore.setState({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'fullapp',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('Full App surface renders the OnboardingModal when activeProvider is null', async () => {
    const { FullAppApp } = await import('../../src/entrypoints/app/App');
    render(React.createElement(FullAppApp));

    await waitFor(() => {
      expect(screen.getByText('Welcome to NowPilot')).toBeDefined();
    });

    expect(screen.getByText(/privacy-first/)).toBeDefined();
    expect(screen.getByText('Welcome')).toBeDefined();
    expect(screen.getByText('Provider')).toBeDefined();
    expect(screen.getByText('API Key')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
  });
});
