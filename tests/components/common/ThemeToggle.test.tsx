import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../../../src/components/common/ThemeToggle';
import { useThemeStore } from '../../../src/core/theme/ThemeStore';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useThemeStore.getState().setMode('light');
  });

  it('renders toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeDefined();
  });

  it('cycles light -> dark -> auto -> light on click', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: /toggle theme/i });
    fireEvent.click(btn);
    expect(useThemeStore.getState().mode).toBe('dark');
    fireEvent.click(btn);
    expect(useThemeStore.getState().mode).toBe('auto');
    fireEvent.click(btn);
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('starts at current store mode', () => {
    useThemeStore.getState().setMode('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /toggle theme/i }));
    expect(useThemeStore.getState().mode).toBe('auto');
  });
});
