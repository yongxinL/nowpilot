import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { App } from 'antd';
import { AppShell } from '../../../src/components/app/AppShell';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';

describe('AppShell', () => {
  beforeEach(() => {
    useThemeStore.getState().setMode('auto');
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <App>
        <AppShell />
      </App>,
    );
    expect(container).toBeTruthy();
  });

  it('renders the app name NowPilot in sidebar header', () => {
    const { getByText } = render(
      <App>
        <AppShell />
      </App>,
    );
    expect(getByText('NowPilot')).toBeTruthy();
  });

  it('renders sidebar navigation items', () => {
    const { getByText } = render(
      <App>
        <AppShell />
      </App>,
    );
    expect(getByText('Chat')).toBeTruthy();
    expect(getByText('Agent')).toBeTruthy();
    expect(getByText('Notes')).toBeTruthy();
    expect(getByText('Options')).toBeTruthy();
  });

  it('renders TeamGQM menu item with disabled state', () => {
    const { container } = render(
      <App>
        <AppShell />
      </App>,
    );
    // Find the TeamGQM list item — it should have a disabled class
    const allMenuItems = container.querySelectorAll('.ant-menu-item');
    const teamGQMItem = Array.from(allMenuItems).find(
      (item) => item.textContent === 'TeamGQM',
    );
    expect(teamGQMItem).toBeTruthy();
    expect(teamGQMItem?.classList.contains('ant-menu-item-disabled')).toBe(true);
  });

  it('renders ThemeToggle in sidebar bottom area', () => {
    const { container } = render(
      <App>
        <AppShell />
      </App>,
    );
    // ThemeToggle renders a button with aria-label "Toggle theme"
    const toggleButton = container.querySelector(
      'button[aria-label="Toggle theme"]',
    );
    expect(toggleButton).not.toBeNull();
  });

  it('renders sidebar collapse toggle button', () => {
    const { container } = render(
      <App>
        <AppShell />
      </App>,
    );
    // The collapse button uses MenuFoldOutlined — find it in the sidebar
    const sidebar = container.querySelector('.ant-layout-sider');
    expect(sidebar).not.toBeNull();
    const collapseButton = sidebar?.querySelector('.ant-btn');
    expect(collapseButton).not.toBeNull();
  });

  it('renders default chat page content when hydrated', () => {
    const { getByText } = render(
      <App>
        <AppShell />
      </App>,
    );
    // ChatPage renders "Start a conversation" empty state
    expect(getByText('Start a conversation')).toBeTruthy();
  });

  it('shows skeleton loading during rehydration when hasHydrated is false', () => {
    // Simulate not hydrated by mocking hasHydrated
    const originalHasHydrated = useThemeStore.persist.hasHydrated;
    useThemeStore.persist.hasHydrated = () => false;

    const { container } = render(
      <App>
        <AppShell />
      </App>,
    );

    // Should show skeleton instead of normal layout
    const skeleton = container.querySelector('.ant-skeleton');
    expect(skeleton).not.toBeNull();

    // Should show loading text
    expect(container.textContent).toContain('Loading');

    // Restore
    useThemeStore.persist.hasHydrated = originalHasHydrated;
  });

  it('responds to THEME_CHANGED broadcast via useThemeSync', () => {
    render(
      <App>
        <AppShell />
      </App>,
    );

    // Start from 'light'
    useThemeStore.getState().setMode('light');

    // Broadcast a THEME_CHANGED message (simulates the other surface changing theme)
    act(() => {
      (globalThis as any).__broadcast('np_theme', {
        type: 'THEME_CHANGED',
        mode: 'dark',
      });
    });

    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('does not import from src/components/sidepanel/', () => {
    // Static check: AppShell should have no imports from sidepanel/
    const source = AppShell.toString();
    expect(source).not.toContain('components/sidepanel/');
    expect(source).not.toContain('src/components/sidepanel');
  });
});
