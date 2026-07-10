import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CommandPalette } from '../../src/core/commands/commandPalette';
import type { Command } from '../../src/core/commands/commandPalette';

const mockCommands: Command[] = [
  { id: 'open-full-app', label: 'Open Full App', action: vi.fn() },
  { id: 'focus-side-panel', label: 'Focus Side Panel', action: vi.fn() },
  { id: 'open-options', label: 'Open Options', action: vi.fn() },
  { id: 'toggle-theme', label: 'Toggle Theme', action: vi.fn(), shortcut: '⌘⇧T' },
];

describe('CommandPalette', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Modal with Input and List when open', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    expect(screen.getByPlaceholderText('Type a command...')).toBeDefined();
    expect(screen.getByText('Open Full App')).toBeDefined();
  });

  it('filters commands case-insensitively', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    const input = screen.getByPlaceholderText('Type a command...');
    fireEvent.change(input, { target: { value: 'theme' } });
    expect(screen.getByText('Toggle Theme')).toBeDefined();
    expect(screen.queryByText('Open Full App')).toBeNull();
  });

  it('renders nothing for empty filter', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    const input = screen.getByPlaceholderText('Type a command...');
    fireEvent.change(input, { target: { value: 'zzzzz' } });
    expect(screen.queryByText('Open Full App')).toBeNull();
  });

  it('Enter key executes selected command and calls onClose', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockCommands[0].action).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('ArrowDown navigates to next command', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockCommands[1].action).toHaveBeenCalled();
  });

  it('ArrowUp navigates to previous command', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockCommands[1].action).toHaveBeenCalled();
  });

  it('Escape key calls onClose via Modal onCancel', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('resets query and selectedIndex when open transitions from false to true', () => {
    const { rerender } = render(React.createElement(CommandPalette, {
      open: false,
      onClose,
      commands: mockCommands,
    }));
    rerender(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    const input = screen.getByPlaceholderText('Type a command...');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('displays shortcut text alongside command label', () => {
    render(React.createElement(CommandPalette, {
      open: true,
      onClose,
      commands: mockCommands,
    }));
    expect(screen.getByText('⌘⇧T')).toBeDefined();
  });
});
