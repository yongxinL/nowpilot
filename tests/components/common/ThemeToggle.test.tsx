import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { App } from 'antd';
import { ThemeToggle } from '../../../src/components/common/ThemeToggle';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Reset to a known state before each test
    useThemeStore.getState().setMode('auto');
    vi.clearAllMocks();
  });

  it('renders a button with an icon', () => {
    const { container } = render(
      <App>
        <ThemeToggle />
      </App>,
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
  });

  it('renders the theme toggle button inside a tooltip wrapper', () => {
    const { container } = render(
      <App>
        <ThemeToggle />
      </App>,
    );
    // The button should have antd Tooltip wrapping (renders as a span wrapper)
    const wrapper = container.querySelector('span');
    expect(wrapper).not.toBeNull();
  });

  it('cycles mode light→dark→auto→light on click', () => {
    // Start from 'auto' mode
    useThemeStore.getState().setMode('auto');

    const { container } = render(
      <App>
        <ThemeToggle />
      </App>,
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();

    // Click: auto → light
    act(() => {
      fireEvent.click(button!);
    });
    expect(useThemeStore.getState().mode).toBe('light');

    // Click: light → dark
    act(() => {
      fireEvent.click(button!);
    });
    expect(useThemeStore.getState().mode).toBe('dark');

    // Click: dark → auto
    act(() => {
      fireEvent.click(button!);
    });
    expect(useThemeStore.getState().mode).toBe('auto');

    // Click: auto → light (full cycle)
    act(() => {
      fireEvent.click(button!);
    });
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('cycles from light to dark on first click when mode is light', () => {
    useThemeStore.getState().setMode('light');

    const { container } = render(
      <App>
        <ThemeToggle />
      </App>,
    );
    const button = container.querySelector('button');

    act(() => {
      fireEvent.click(button!);
    });
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('cycles from dark to auto on first click when mode is dark', () => {
    useThemeStore.getState().setMode('dark');

    const { container } = render(
      <App>
        <ThemeToggle />
      </App>,
    );
    const button = container.querySelector('button');

    act(() => {
      fireEvent.click(button!);
    });
    expect(useThemeStore.getState().mode).toBe('auto');
  });

  it('ThemeStore persists mode changes to chrome.storage.local', async () => {
    // Set mode and verify it's persisted
    useThemeStore.getState().setMode('dark');

    // The persist middleware should have written to chrome.storage.local
    // under the key 'np_theme_store'
    const stored = await chrome.storage.local.get('np_theme_store');
    expect(stored).toHaveProperty('np_theme_store');

    const parsed = JSON.parse(stored.np_theme_store as string);
    expect(parsed.state.mode).toBe('dark');
  });

  it('ThemeStore.resolvedMode returns light when mode is auto in test env', () => {
    useThemeStore.getState().setMode('auto');
    expect(useThemeStore.getState().resolvedMode()).toBe('light');
  });
});
