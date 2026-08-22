import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { MirrorBanner } from '../../src/components/common/MirrorBanner';

function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
}

describe('MirrorBanner (Plan 01-07 — D-05, REQ-F05)', () => {
  it('renders the literal caption "Switched to Standalone." and a "Refocus here" link', () => {
    const onRefocus = vi.fn();
    renderWithAntd(<MirrorBanner onRefocus={onRefocus} />);

    expect(screen.getByText('Switched to Standalone.')).toBeTruthy();
    expect(screen.getByText('Refocus here')).toBeTruthy();
  });

  it('clicking "Refocus here" calls the onRefocus callback exactly once', () => {
    const onRefocus = vi.fn();
    renderWithAntd(<MirrorBanner onRefocus={onRefocus} />);

    const link = screen.getByText('Refocus here');
    fireEvent.click(link);

    expect(onRefocus).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger a page reload when "Refocus here" is clicked', () => {
    const onRefocus = vi.fn();
    renderWithAntd(<MirrorBanner onRefocus={onRefocus} />);

    const link = screen.getByText('Refocus here');
    // jsdom's window.location.reload throws "Not implemented: navigation"
    // if invoked. A click that did NOT call onRefocus-and-reload via the
    // plan contract must not throw — only the callback runs.
    expect(() => fireEvent.click(link)).not.toThrow();
    expect(onRefocus).toHaveBeenCalledTimes(1);
  });
});
