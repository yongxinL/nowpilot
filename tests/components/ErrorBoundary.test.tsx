// tests/components/ErrorBoundary.test.tsx — render-crash fallback contract
// (T-1-08: fallback shows generic STR copy, never raw error text; error routed
// to debugLog COMPONENT_RENDER per Golden Rule 9). jsdom default env.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { STR } from '@/core/i18n/strings';

function Flaky({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom-secret');
  return <div>content ok</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>happy path</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('happy path')).toBeTruthy();
  });

  it('catches a render error and shows the generic STR fallback, never the raw message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Flaky shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(STR.chat.errorRetry)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    // T-1-08 / R-10: the raw error text must never reach the DOM
    expect(screen.queryByText(/boom-secret/)).toBeNull();
    consoleSpy.mockRestore();
  });

  it('logs the crash through debugLog with the canonical COMPONENT_RENDER code', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Flaky shouldThrow />
      </ErrorBoundary>,
    );
    const logged = consoleSpy.mock.calls.map((args) => String(args[0])).join('\n');
    expect(logged).toContain('[COMPONENT_RENDER]');
    expect(logged).toContain('boom-secret');
    consoleSpy.mockRestore();
  });

  it('resets via the Try again button and re-renders children', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn();
    const { rerender } = render(
      <ErrorBoundary onReset={onReset}>
        <Flaky shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(STR.chat.errorRetry)).toBeTruthy();
    rerender(
      <ErrorBoundary onReset={onReset}>
        <Flaky shouldThrow={false} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('content ok')).toBeTruthy();
    expect(onReset).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});
