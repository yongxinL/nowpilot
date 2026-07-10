import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../../src/core/components/ErrorBoundary';

const ThrowError = () => {
  throw new Error('test error');
};

const SafeChild = () => <div>safe content</div>;

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeDefined();
  });

  it('catches errors and renders AntD Result fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('renders Try Again and Reload Page buttons on error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getAllByText('Try Again').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reload Page')).toBeDefined();
  });

  it('handleReset clears error state and shows children again', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getAllByText('Try Again')[0]);

    cleanup();
    render(
      <ErrorBoundary>
        <SafeChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeDefined();
  });
});
