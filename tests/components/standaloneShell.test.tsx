import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';

afterEach(cleanup);

describe('StandaloneShell', () => {
  it('shows the sider and the active page, and switches pages on navigation', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', () => <div>Chat page body</div>);
    registry.register('notes', () => <div>Notes page body</div>);
    render(<StandaloneShell registry={registry} initialHash="#/chat" />);
    expect(screen.getByText('Chat page body')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Notes'));
    expect(screen.getByText('Notes page body')).toBeInTheDocument();
  });

  it('reports the STANDALONE_ROUTE_FALLBACK diagnostic for an unknown hash', () => {
    const registry = createStandalonePageRegistry();
    registry.register('chat', () => <div>Chat page body</div>);
    const onRouteFallback = vi.fn();
    render(
      <StandaloneShell
        registry={registry}
        initialHash="#/nope"
        onRouteFallback={onRouteFallback}
      />,
    );
    expect(onRouteFallback).toHaveBeenCalledWith('#/nope');
  });
});
