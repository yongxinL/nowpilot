import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act, screen } from '@testing-library/react';
import React from 'react';
import { App } from 'antd';
import { CommandPalette } from '../../../src/components/common/CommandPalette';
import type { Command } from '../../../src/core/commands/CommandRegistry';

const createCommand = (overrides?: Partial<Command>): Command => ({
  id: 'test-1',
  name: 'Test Command',
  description: 'A test command',
  category: 'System',
  action: vi.fn(),
  ...overrides,
});

const defaultCommands: Command[] = [
  createCommand({ id: 'theme-1', name: 'Toggle Theme', description: 'Switch between light, dark, and auto', category: 'Appearance' }),
  createCommand({ id: 'nav-1', name: 'Open Full App', description: 'Open the full application in a new tab', category: 'Navigation' }),
  createCommand({ id: 'sys-1', name: 'Reload Extension', description: 'Reload the Chrome extension', category: 'System' }),
];

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('open/close', () => {
    it('renders Modal with Input and results list when open=true', () => {
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={true} onClose={() => {}} />
        </App>,
      );
      // Modal should be visible — search input rendered
      const input = screen.getByPlaceholderText('Search commands…');
      expect(input).toBeDefined();
      // Results should be visible
      expect(screen.getByText('Toggle Theme')).toBeDefined();
      expect(screen.getByText('Open Full App')).toBeDefined();
      expect(screen.getByText('Reload Extension')).toBeDefined();
    });

    it('does not render Modal content when open=false', () => {
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={false} onClose={() => {}} />
        </App>,
      );
      // The input should not be in the document
      expect(screen.queryByPlaceholderText('Search commands…')).toBeNull();
    });
  });

  describe('search filtering', () => {
    it('typing in Input filters results by name (case-insensitive)', () => {
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={true} onClose={() => {}} />
        </App>,
      );
      const input = screen.getByPlaceholderText('Search commands…');

      act(() => {
        fireEvent.change(input, { target: { value: 'theme' } });
      });

      expect(screen.getByText('Toggle Theme')).toBeDefined();
      expect(screen.queryByText('Open Full App')).toBeNull();
      expect(screen.queryByText('Reload Extension')).toBeNull();
    });

    it('filtering is case-insensitive (searches "THEME")', () => {
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={true} onClose={() => {}} />
        </App>,
      );
      const input = screen.getByPlaceholderText('Search commands…');

      act(() => {
        fireEvent.change(input, { target: { value: 'THEME' } });
      });

      expect(screen.getByText('Toggle Theme')).toBeDefined();
    });

    it('filtering matches description content', () => {
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={true} onClose={() => {}} />
        </App>,
      );
      const input = screen.getByPlaceholderText('Search commands…');

      act(() => {
        fireEvent.change(input, { target: { value: 'chrome' } });
      });

      // "chrome" is in "Reload the Chrome extension" description
      expect(screen.getByText('Reload Extension')).toBeDefined();
    });
  });

  describe('keyboard navigation', () => {
    it('pressing Escape calls onClose', () => {
      const onClose = vi.fn();
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={true} onClose={onClose} />
        </App>,
      );

      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('pressing Enter on selected item calls command.action() and onClose', () => {
      const onClose = vi.fn();
      const action = vi.fn();
      const commands = [createCommand({ id: 'test', name: 'Only Command', description: 'The only one', category: 'System', action })];

      render(
        <App>
          <CommandPalette commands={commands} open={true} onClose={onClose} />
        </App>,
      );

      act(() => {
        fireEvent.keyDown(window, { key: 'Enter' });
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ArrowDown increments selectedIndex, ArrowUp decrements', () => {
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={true} onClose={() => {}} />
        </App>,
      );

      // ArrowDown twice
      act(() => { fireEvent.keyDown(window, { key: 'ArrowDown' }); });
      act(() => { fireEvent.keyDown(window, { key: 'ArrowDown' }); });

      // ArrowUp once
      act(() => { fireEvent.keyDown(window, { key: 'ArrowUp' }); });

      // Press Enter — should execute the second item (after down-down-up that's index 1)
      const action = defaultCommands[1].action;
      act(() => { fireEvent.keyDown(window, { key: 'Enter' }); });

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('ArrowDown wraps at the last item', () => {
      const action0 = vi.fn();
      const commands = [
        createCommand({ id: 'a', name: 'Alpha', description: 'First', category: 'System', action: action0 }),
      ];

      render(
        <App>
          <CommandPalette commands={commands} open={true} onClose={() => {}} />
        </App>,
      );

      // ArrowDown past the only item
      act(() => { fireEvent.keyDown(window, { key: 'ArrowDown' }); });

      // Enter should still execute the only item (selectedIndex clamped at 0)
      act(() => { fireEvent.keyDown(window, { key: 'Enter' }); });
      expect(action0).toHaveBeenCalledTimes(1);
    });

    it('ArrowUp stays at 0 for first item', () => {
      const action0 = vi.fn();
      const commands = [
        createCommand({ id: 'a', name: 'Alpha', description: 'First', category: 'System', action: action0 }),
      ];

      render(
        <App>
          <CommandPalette commands={commands} open={true} onClose={() => {}} />
        </App>,
      );

      // ArrowUp — should stay at 0
      act(() => { fireEvent.keyDown(window, { key: 'ArrowUp' }); });

      // Enter should still execute
      act(() => { fireEvent.keyDown(window, { key: 'Enter' }); });
      expect(action0).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty state', () => {
    it('shows "No matching commands — try a different search term" when no results', () => {
      render(
        <App>
          <CommandPalette commands={defaultCommands} open={true} onClose={() => {}} />
        </App>,
      );
      const input = screen.getByPlaceholderText('Search commands…');

      act(() => {
        fireEvent.change(input, { target: { value: 'zzzznonexistent' } });
      });

      expect(screen.getByText('No matching commands — try a different search term')).toBeDefined();
    });
  });

  describe('click execution', () => {
    it('clicking a result item executes the command and closes', () => {
      const onClose = vi.fn();
      const action = vi.fn();
      const commands = [createCommand({ id: 'click-test', name: 'Clickable', description: 'Click me', category: 'System', action })];

      render(
        <App>
          <CommandPalette commands={commands} open={true} onClose={onClose} />
        </App>,
      );

      // Find the list item and click it
      const item = screen.getByText('Clickable');
      act(() => {
        fireEvent.click(item);
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
