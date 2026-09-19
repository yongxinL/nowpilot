import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';

afterEach(cleanup);

describe('SidePanelShell', () => {
  it('is Chat-only with a header, chat region, and deterministic empty state', () => {
    render(<SidePanelShell onNavigate={() => {}} />);
    expect(screen.getByRole('region', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByText('NowPilot')).toBeInTheDocument();
    expect(screen.queryByText('Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnostics')).not.toBeInTheDocument();
  });

  it('exposes only the Options and Switch to Full Chat actions', () => {
    const onNavigate = vi.fn();
    render(<SidePanelShell onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(onNavigate).toHaveBeenCalledWith('options');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Full Chat' }));
    expect(onNavigate).toHaveBeenCalledWith('chat');
  });

  it('contains no interactive chat controls in Phase 01', () => {
    render(<SidePanelShell onNavigate={() => {}} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /attach/i })).not.toBeInTheDocument();
  });
});
