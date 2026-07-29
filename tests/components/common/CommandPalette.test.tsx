import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../../../src/components/common/CommandPalette';
import type { Command } from '../../../src/core/commands/CommandRegistry';

const mockCommands: Command[] = [
  { id: 'toggle-theme', name: 'Toggle Theme', description: 'Cycle theme modes', category: 'Appearance', action: vi.fn() },
  { id: 'open-full-app', name: 'Open in Full Tab', description: 'Open full app', category: 'Navigation', action: vi.fn() },
  { id: 'reload', name: 'Reload Extension', description: 'Reload the extension', category: 'System', action: vi.fn() },
];

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<CommandPalette commands={mockCommands} open={true} onClose={() => {}} />);
    expect(screen.getByPlaceholderText('Search commands…')).toBeDefined();
  });

  it('does not render modal content when closed', () => {
    render(<CommandPalette commands={mockCommands} open={false} onClose={() => {}} />);
    expect(screen.queryByPlaceholderText('Search commands…')).toBeNull();
  });

  it('filters commands by name', () => {
    render(<CommandPalette commands={mockCommands} open={true} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Search commands…');
    fireEvent.change(input, { target: { value: 'theme' } });
    expect(screen.getByText('Toggle Theme')).toBeDefined();
    expect(screen.queryByText('Open in Full Tab')).toBeNull();
  });

  it('filters commands by description', () => {
    render(<CommandPalette commands={mockCommands} open={true} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Search commands…');
    fireEvent.change(input, { target: { value: 'cycle' } });
    expect(screen.getByText('Toggle Theme')).toBeDefined();
  });

  it('shows empty state when no results', () => {
    render(<CommandPalette commands={mockCommands} open={true} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Search commands…');
    fireEvent.change(input, { target: { value: 'zzzzz' } });
    expect(screen.getByText(/no matching commands/i)).toBeDefined();
  });

  it('executes command and calls onClose on click', () => {
    const onClose = vi.fn();
    render(<CommandPalette commands={mockCommands} open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Toggle Theme'));
    expect(mockCommands[0].action).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('executes selected command on Enter', () => {
    const onClose = vi.fn();
    render(<CommandPalette commands={mockCommands} open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockCommands[1].action).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
