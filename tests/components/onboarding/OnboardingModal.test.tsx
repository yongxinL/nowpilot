import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock antd theme
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    theme: {
      ...actual.theme,
      useToken: () => ({
        token: {
          marginXS: 8,
          marginSM: 12,
          marginMD: 16,
          marginLG: 20,
          padding: 16,
          paddingXS: 8,
          paddingSM: 12,
          borderRadiusLG: 8,
          borderRadius: 6,
          colorPrimary: '#e0582e',
          colorFillSecondary: '#f5f5f5',
          colorFillTertiary: '#e8e8e8',
          colorBgLayout: '#fafafa',
          colorBgContainer: '#ffffff',
          colorBorderSecondary: '#f0f0f0',
          colorText: '#000000',
          colorTextSecondary: '#666666',
          colorTextQuaternary: '#999999',
        },
      }),
    },
  };
});

import { MeetNowPilotStep } from '../../../src/components/onboarding/MeetNowPilotStep';

describe('MeetNowPilotStep', () => {
  afterEach(() => {
    cleanup();
  });

  // Test 1: Renders bunny avatar (64px, primary-color border ring)
  it('renders bunny avatar with 64px size and primary border ring', () => {
    const { container } = render(
      <MeetNowPilotStep onContinue={vi.fn()} onSkip={vi.fn()} />
    );

    const avatar = container.querySelector('.ant-avatar');
    expect(avatar).toBeTruthy();
  });

  // Test 2: Renders "Meet NowPilot" as title and tagline
  it('renders persona name and tagline', () => {
    const { container } = render(
      <MeetNowPilotStep onContinue={vi.fn()} onSkip={vi.fn()} />
    );

    expect(container.textContent).toContain('Meet NowPilot');
    expect(container.textContent).toContain('Your AI work co-pilot');
  });

  // Test 3: Renders 4 core value badges
  it('renders 4 core value badges: Privacy-first, Helpful, Precise, Humble', () => {
    const { container } = render(
      <MeetNowPilotStep onContinue={vi.fn()} onSkip={vi.fn()} />
    );

    expect(container.textContent).toContain('Privacy-first');
    expect(container.textContent).toContain('Helpful');
    expect(container.textContent).toContain('Precise');
    expect(container.textContent).toContain('Humble');
  });

  // Test 4: Renders 4 capability preview cards
  it('renders 4 capability preview cards', () => {
    const { container } = render(
      <MeetNowPilotStep onContinue={vi.fn()} onSkip={vi.fn()} />
    );

    expect(container.textContent).toContain('Summarize Pages');
    expect(container.textContent).toContain('Research Topics');
    expect(container.textContent).toContain('Draft Responses');
    expect(container.textContent).toContain('Explain Code');
  });

  // Test 5: Continue button calls onContinue
  it('Continue button calls onContinue', () => {
    const onContinue = vi.fn();
    const onSkip = vi.fn();
    render(<MeetNowPilotStep onContinue={onContinue} onSkip={onSkip} />);

    fireEvent.click(screen.getByText('Continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  // Test 6: Skip link calls onSkip
  it('Skip link calls onSkip', () => {
    const onContinue = vi.fn();
    const onSkip = vi.fn();
    render(<MeetNowPilotStep onContinue={onContinue} onSkip={onSkip} />);

    fireEvent.click(screen.getByText('Skip for now'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });
});
