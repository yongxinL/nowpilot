import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OnboardingModal } from '../../src/core/onboarding/OnboardingModal';

describe('OnboardingModal', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Modal with title and Steps when open', () => {
    render(React.createElement(OnboardingModal, { open: true, onComplete }));
    expect(screen.getByText('Welcome to NowPilot')).toBeDefined();
    expect(screen.getByText('Welcome')).toBeDefined();
    expect(screen.getByText('Provider')).toBeDefined();
    expect(screen.getByText('API Key')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
  });

  it('starts at step 0 with welcome content', () => {
    render(React.createElement(OnboardingModal, { open: true, onComplete }));
    expect(screen.getByText(/privacy-first/)).toBeDefined();
  });

  it('Next button advances steps with content changes', () => {
    render(React.createElement(OnboardingModal, { open: true, onComplete }));
    const next = screen.getAllByText('Next')[0];
    fireEvent.click(next);
    expect(screen.getByText('Select your AI provider')).toBeDefined();
  });

  it('Back button returns to previous step', () => {
    render(React.createElement(OnboardingModal, { open: true, onComplete }));
    fireEvent.click(screen.getAllByText('Next')[0]);
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText(/privacy-first/)).toBeDefined();
  });

  it('Back button is hidden on step 0', () => {
    render(React.createElement(OnboardingModal, { open: true, onComplete }));
    expect(screen.queryByText('Back')).toBeNull();
  });
});
