import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';

describe('SidePanelShell', () => {
  it('renders the chat-only shell', () => {
    render(<SidePanelShell />);
    expect(screen.getByText('NowPilot')).toBeInTheDocument();
    expect(screen.getByLabelText('Options')).toBeInTheDocument();
    expect(screen.getByLabelText('Switch to Full chat')).toBeInTheDocument();
  });

  it('shows the empty chat placeholder', () => {
    render(<SidePanelShell />);
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });
});
