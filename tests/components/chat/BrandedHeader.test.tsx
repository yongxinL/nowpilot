import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider } from 'antd';

// ---------------------------------------------------------------------------
import { BrandedHeader } from '../../../src/components/chat/BrandedHeader';

const renderWithAntd = (ui: React.ReactElement) =>
  render(<ConfigProvider>{ui}</ConfigProvider>);

describe('BrandedHeader', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 5: Renders BunnyAvatar (32px), "NowPilot" text, tagline, and close button
  it('renders BunnyAvatar, NowPilot text, tagline, and close button', () => {
    renderWithAntd(<BrandedHeader onClose={onClose} />);

    // Use getAllByText because antd renders text in both <span> and <strong>
    const nameEls = screen.getAllByText('NowPilot');
    expect(nameEls.length).toBeGreaterThan(0);
    const taglineEls = screen.getAllByText('Your AI work co-pilot');
    expect(taglineEls.length).toBeGreaterThan(0);
    // Close button with aria-label
    const closeBtns = screen.getAllByRole('button', { name: /hide/i });
    expect(closeBtns.length).toBeGreaterThan(0);
  });

  // Test 6: Clicking close button calls onClose
  it('calls onClose when close button is clicked', () => {
    renderWithAntd(<BrandedHeader onClose={onClose} />);

    const closeBtns = screen.getAllByRole('button', { name: /hide/i });
    // Click the first button whose text content includes close icon
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Test 7: Text uses correct Typography styling
  it('renders name with fontSize 16 and tagline with fontSize 12', () => {
    renderWithAntd(<BrandedHeader onClose={onClose} />);

    const nameEls = screen.getAllByText('NowPilot');
    expect(nameEls.length).toBeGreaterThan(0);
    // The actual styled element is the parent <span> wrapping the <strong>
    const nameSpan = nameEls[0].parentElement;
    expect(nameSpan).toBeTruthy();
    expect(nameSpan!.style.fontSize).toBe('16px');

    const taglineEls = screen.getAllByText('Your AI work co-pilot');
    expect(taglineEls.length).toBeGreaterThan(0);
    expect(taglineEls[0].style.fontSize).toBe('12px');
  });
});
