import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/components/CommandPalette';
import { CommandRegistry } from '@/core/commands/CommandRegistry';

describe('CommandPalette', () => {
  beforeEach(() => {
    CommandRegistry.clear();
  });

  it('opens on Cmd+K and lists commands', async () => {
    CommandRegistry.register({ id: 'test-cmd', label: 'Test Command', handler: () => {} });
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(await screen.findByText('Test Command')).toBeInTheDocument();
  });

  it('executes the selected command', async () => {
    const handler = vi.fn();
    CommandRegistry.register({ id: 'exec-cmd', label: 'Exec Command', handler });
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const item = await screen.findByText('Exec Command');
    fireEvent.click(item);
    expect(handler).toHaveBeenCalled();
  });

  it('filters commands by query', async () => {
    CommandRegistry.register({ id: 'alpha', label: 'Alpha Command', handler: () => {} });
    CommandRegistry.register({ id: 'beta', label: 'Beta Command', handler: () => {} });
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = await screen.findByLabelText('Search commands');
    fireEvent.change(input, { target: { value: 'alpha' } });
    expect(await screen.findByText('Alpha Command')).toBeInTheDocument();
    expect(screen.queryByText('Beta Command')).not.toBeInTheDocument();
  });
});
