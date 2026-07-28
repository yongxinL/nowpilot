import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, act, screen } from '@testing-library/react';
import React from 'react';
import { App } from 'antd';
import { OnboardingWizard } from '../../../src/components/common/OnboardingWizard';

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 "Chat with AI" heading and body copy', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    // Step 1 (index 1) — "Chat with AI" heading
    expect(screen.getByText('Chat with AI')).toBeDefined();
    // Body copy for step 1
    expect(
      screen.getByText(
        'Ask questions, brainstorm ideas, and get help with any task — powered by your own AI providers.',
      ),
    ).toBeDefined();
  });

  it('renders Step 2 "Capture Knowledge" heading and body copy', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    expect(screen.getByText('Capture Knowledge')).toBeDefined();
    expect(
      screen.getByText(
        'Save important insights as atomic notes with automatic tagging and organization.',
      ),
    ).toBeDefined();
  });

  it('renders Step 3 "Your Workspace, Your Way" heading and body copy', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    expect(screen.getByText('Your Workspace, Your Way')).toBeDefined();
    expect(
      screen.getByText(
        'Toggle between light and dark themes. Open the full app for deep work and configuration.',
      ),
    ).toBeDefined();
  });

  it('renders welcome banner "Welcome to NowPilot" heading and subtext on step 0', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    // Welcome banner should always be visible alongside all 3 cards
    expect(screen.getByText('Welcome to NowPilot')).toBeDefined();
    expect(
      screen.getByText(
        'Your personal AI assistant and knowledge workspace — right in your browser.',
      ),
    ).toBeDefined();
  });

  it('navigates forward and backward with Next/Previous buttons', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    // Should start showing welcome banner and Chat with AI card as current step
    // (all cards visible; what changes is the Steps indicator)

    // Find and click "Next Step"
    const nextButton = screen.getByText('Next Step');
    act(() => {
      fireEvent.click(nextButton);
    });

    // Previous button should now be enabled
    const prevButton = screen.getByText('Previous Step');
    expect(prevButton).toBeDefined();

    // Click Previous to go back
    act(() => {
      fireEvent.click(prevButton);
    });

    // Next Step should still be visible (back on step 0→1)
    expect(screen.getByText('Next Step')).toBeDefined();
  });

  it('renders "Previous Step" button disabled on the first step', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    // Previous Step button should be disabled on first render (step 0)
    const prevButton = screen.getByText('Previous Step');
    expect(prevButton).toBeDefined();
    expect(prevButton.closest('button')).toHaveProperty('disabled', true);
  });

  it('shows "Start Exploring" CTA button on step 3 instead of "Next Step"', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    // Step through: step 0→1→2→3
    const nextButton = screen.getByText('Next Step');
    act(() => { fireEvent.click(nextButton); }); // step 1
    act(() => { fireEvent.click(screen.getByText('Next Step')); }); // step 2
    act(() => { fireEvent.click(screen.getByText('Next Step')); }); // step 3

    // "Next Step" should no longer be visible
    expect(screen.queryByText('Next Step')).toBeNull();

    // "Start Exploring" should appear
    expect(screen.getByText('Start Exploring')).toBeDefined();
  });

  it('calls onComplete when "Start Exploring" is clicked on step 3', () => {
    const onComplete = vi.fn();
    render(
      <App>
        <OnboardingWizard open={true} onComplete={onComplete} />
      </App>,
    );

    // Navigate to step 3
    const nextButton = screen.getByText('Next Step');
    act(() => { fireEvent.click(nextButton); }); // step 1
    act(() => { fireEvent.click(screen.getByText('Next Step')); }); // step 2
    act(() => { fireEvent.click(screen.getByText('Next Step')); }); // step 3

    // Click "Start Exploring"
    act(() => {
      fireEvent.click(screen.getByText('Start Exploring'));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when "Skip Onboarding" link is clicked', () => {
    const onComplete = vi.fn();
    render(
      <App>
        <OnboardingWizard open={true} onComplete={onComplete} />
      </App>,
    );

    const skipButton = screen.getByText('Skip Onboarding');
    expect(skipButton).toBeDefined();

    act(() => {
      fireEvent.click(skipButton);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders antd Steps component showing current step indicator', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    // Steps titles should be rendered
    expect(screen.getByText('Chat with AI')).toBeDefined();
    expect(screen.getByText('Capture Knowledge')).toBeDefined();
    expect(screen.getByText('Your Workspace, Your Way')).toBeDefined();
  });

  it('renders cards with illustration placeholder areas using icons', () => {
    render(
      <App>
        <OnboardingWizard open={true} onComplete={() => {}} />
      </App>,
    );

    // Each step card should have an icon (antd icon components)
    // Check that the card containers render — the icons are rendered inside flex containers
    const cards = document.querySelectorAll('.ant-card');
    expect(cards.length).toBeGreaterThanOrEqual(3);

    // Illustration caption text should render
    const illustrationCaptions = screen.getAllByText('Illustration');
    expect(illustrationCaptions.length).toBeGreaterThanOrEqual(3);
  });

  it('does not render when open=false', () => {
    render(
      <App>
        <OnboardingWizard open={false} onComplete={() => {}} />
      </App>,
    );

    // The modal content should not be in the document
    expect(screen.queryByText('Welcome to NowPilot')).toBeNull();
  });
});
