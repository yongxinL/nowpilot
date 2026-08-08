// tests/components/cmdk/CmdKPicker.test.tsx — Flow 10 command palette (W-8,
// D-15): opens on mod+k via isCmdK, filters by query, exposes EXACTLY the
// three Phase-1 commands, Enter runs the highlighted command through
// WorkspaceRouter (the only surface-open path, Pitfall 1), Escape closes.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CmdKPicker } from '@/components/cmdk/CmdKPicker';
import { STR } from '@/core/i18n/strings';
import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';

vi.mock('@/core/workspace/WorkspaceRouter', () => ({
  WorkspaceRouter: {
    openStandalone: vi.fn(() => Promise.resolve()),
    openSidePanel: vi.fn(() => Promise.resolve()),
  },
}));

function openPalette(): void {
  fireEvent.keyDown(window, { key: 'k', metaKey: true });
}

describe('CmdKPicker (Flow 10)', () => {
  it('opens on mod+k (isCmdK) and shows the search placeholder', () => {
    render(<CmdKPicker />);
    expect(screen.queryByPlaceholderText(STR.cmdk.placeholder)).toBeNull();
    openPalette();
    expect(screen.getByPlaceholderText(STR.cmdk.placeholder)).toBeTruthy();
  });

  it('lists EXACTLY the W-8 command set (no stub commands)', () => {
    render(<CmdKPicker />);
    openPalette();
    expect(screen.getByText('Open Standalone')).toBeTruthy();
    expect(screen.getByText('Focus Side Panel')).toBeTruthy();
    expect(screen.getByText('Open Options')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('filters the command list by query', () => {
    render(<CmdKPicker />);
    openPalette();
    const input = screen.getByPlaceholderText(STR.cmdk.placeholder);
    fireEvent.change(input, { target: { value: 'options' } });
    expect(screen.getByText('Open Options')).toBeTruthy();
    expect(screen.queryByText('Open Standalone')).toBeNull();
    expect(screen.queryByText('Focus Side Panel')).toBeNull();
  });

  it('Enter runs the highlighted command through WorkspaceRouter (open-standalone)', () => {
    render(<CmdKPicker />);
    openPalette();
    const input = screen.getByPlaceholderText(STR.cmdk.placeholder);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(WorkspaceRouter.openStandalone).toHaveBeenCalledTimes(1);
    expect(WorkspaceRouter.openSidePanel).not.toHaveBeenCalled();
  });

  it('Escape closes the palette (FocusTrap onEscape) and focus is released', async () => {
    render(<CmdKPicker />);
    openPalette();
    const input = screen.getByPlaceholderText(STR.cmdk.placeholder);
    fireEvent.keyDown(input, { key: 'Escape' });
    // destroyOnHidden unmounts the content after the leave animation — waitFor
    // tolerates the rc-motion frame timing in jsdom.
    await waitFor(() => expect(screen.queryByPlaceholderText(STR.cmdk.placeholder)).toBeNull());
  });
});
