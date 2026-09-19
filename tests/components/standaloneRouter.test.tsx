import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import { StandaloneRouter } from '@/components/standalone/StandaloneRouter';

afterEach(cleanup);

function registryWithChat() {
  const registry = createStandalonePageRegistry();
  registry.register('chat', () => <div>Chat page body</div>);
  registry.register('notes', () => <div>Notes page body</div>);
  return registry;
}

describe('StandaloneRouter', () => {
  it('renders the page for the active route', () => {
    render(<StandaloneRouter registry={registryWithChat()} routeId="notes" />);
    expect(screen.getByText('Notes page body')).toBeInTheDocument();
  });

  it('renders nothing missing a registered page', () => {
    const registry = createStandalonePageRegistry();
    const { container } = render(<StandaloneRouter registry={registry} routeId="chat" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('useStandaloneRoute', () => {
  it('falls back to chat for an unknown hash and reports it', async () => {
    const { useStandaloneRoute } = await import('@/components/standalone/StandaloneRouter');
    const onFallback = vi.fn();
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const Harness = () => {
      const { routeId } = useStandaloneRoute({
        initialHash: '#/unknown',
        onRouteFallback: onFallback,
      });
      return <div>{routeId}</div>;
    };
    render(<Harness />);
    expect(screen.getByText('chat')).toBeInTheDocument();
    expect(onFallback).toHaveBeenCalledWith('#/unknown');
    expect(replaceState).toHaveBeenCalledWith(null, '', '#/chat');
    replaceState.mockRestore();
  });
});
