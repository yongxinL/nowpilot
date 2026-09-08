import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';

describe('StandaloneShell', () => {
  it('renders the workspace shell with navigation', () => {
    render(<StandaloneShell />);
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Options')).toBeInTheDocument();
  });

  it('renders the default chat page', () => {
    render(<StandaloneShell />);
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });
});
