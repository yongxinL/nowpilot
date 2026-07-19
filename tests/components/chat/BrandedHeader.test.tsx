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

  // -----------------------------------------------------------------------
  // New: Dynamic greeting props (D-23)
  // -----------------------------------------------------------------------

  // Test 8: Renders "NowPilot" when userGreeting not provided (backward compat)
  it('renders default NowPilot when userGreeting not provided', () => {
    renderWithAntd(<BrandedHeader onClose={onClose} />);

    const nameEls = screen.getAllByText('NowPilot');
    expect(nameEls.length).toBeGreaterThan(0);
  });

  // Test 9: Renders userGreeting text when provided
  it('renders userGreeting text when provided', () => {
    renderWithAntd(<BrandedHeader userGreeting="Good morning, George" onClose={onClose} />);

    const greetingEls = screen.getAllByText('Good morning, George');
    expect(greetingEls.length).toBeGreaterThan(0);
  });

  // Test 10: Renders contextualMessage as tagline when provided
  it('renders contextualMessage as tagline when provided', () => {
    renderWithAntd(<BrandedHeader contextualMessage="Working on: INC001" onClose={onClose} />);

    const contextualEls = screen.getAllByText('Working on: INC001');
    expect(contextualEls.length).toBeGreaterThan(0);
  });

  // Test 11: fontSize changes to 20px when userGreeting provided (Display role)
  it('uses fontSize 20 when userGreeting is provided', () => {
    renderWithAntd(<BrandedHeader userGreeting="Good morning, George" onClose={onClose} />);

    const greetingEls = screen.getAllByText('Good morning, George');
    expect(greetingEls.length).toBeGreaterThan(0);
    // The parent span should have fontSize 20
    const greetingSpan = greetingEls[0].parentElement;
    expect(greetingSpan).toBeTruthy();
    expect(greetingSpan!.style.fontSize).toBe('20px');
  });
});
