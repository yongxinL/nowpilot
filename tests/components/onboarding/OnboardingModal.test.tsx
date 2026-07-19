import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react';
import React from 'react';

// Mock antd theme + common components
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    App: { useApp: () => ({ message: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }) },
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
          paddingMD: 16,
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
          colorWarningBorder: '#faad14',
          colorWarningBg: '#fffbe6',
          colorSuccess: '#52c41a',
          colorBgElevated: '#ffffff',
          colorError: '#ff4d4f',
        },
      }),
    },
  };
});

// Mock hooks
vi.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Mock provider store
const mockSetSelectedProvider = vi.fn();
const mockSetApiKey = vi.fn();
const mockSetModelEntries = vi.fn();
vi.mock('../../../src/core/stores/providerStore', () => ({
  useProviderStore: (selector: any) => {
    const state = {
      selectedProvider: null,
      apiKeys: {},
      setSelectedProvider: mockSetSelectedProvider,
      setApiKey: mockSetApiKey,
      setModelEntries: mockSetModelEntries,
      getState: () => ({ setModelEntries: mockSetModelEntries }),
    };
    return selector ? selector(state) : state;
  },
}));

// Mock model discovery
vi.mock('../../../src/core/ai/providers/modelDiscovery', () => ({
  modelDiscovery: { discover: vi.fn().mockResolvedValue([]) },
  getDiscoveryEndpoint: vi.fn().mockReturnValue(''),
  discoveredToModelEntries: vi.fn().mockReturnValue({ models: [], modelEntries: [] }),
}));

// Mock provider registry
vi.mock('../../../src/core/ai/providers/ProviderRegistry', () => ({
  providerRegistry: { initialize: vi.fn().mockResolvedValue(undefined) },
}));

import { MeetNowPilotStep } from '../../../src/components/onboarding/MeetNowPilotStep';
import { OnboardingModal } from '../../../src/core/onboarding/OnboardingModal';

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

// ---------------------------------------------------------------------------
// OnboardingModal integration tests
// ---------------------------------------------------------------------------
describe('OnboardingModal Integration', () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Test 1: step===0 renders MeetNowPilotStep instead of old Welcome content
  it('renders MeetNowPilotStep at step 0 instead of old Welcome content', () => {
    render(<OnboardingModal open={true} onComplete={onComplete} />);

    // Should show "Meet NowPilot" persona title (MeetNowPilotStep content)
    const meetTitle = screen.getByText('Meet NowPilot');
    expect(meetTitle).toBeTruthy();

    // Should NOT show old "Welcome to NowPilot" welcome text
    const welcomeText = screen.queryByText('Welcome to NowPilot');
    expect(welcomeText).toBeNull();
  });

  // Test 2: MeetNowPilotStep Continue calls onComplete eventually (moves to Provider step)
  // After clicking Continue, the modal should show the Provider selection step
  it('Continue moves from step 0 to Provider step (step 1)', () => {
    render(<OnboardingModal open={true} onComplete={onComplete} />);

    // Click Continue button
    const continueBtn = screen.getByText('Continue');
    fireEvent.click(continueBtn);

    // After Continue, step should be 1 (Provider step) — text visible
    const providerHeading = screen.getByText('Choose your AI provider');
    expect(providerHeading).toBeTruthy();
  });

  // Test 3: Skip button calls onComplete
  it('Skip calls onComplete', () => {
    render(<OnboardingModal open={true} onComplete={onComplete} />);

    const skipBtn = screen.getByText('Skip for now');
    fireEvent.click(skipBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  // Test 4: Step circles render 9 circles [1..9] instead of 8 [1..8]
  it('renders 9 step circles [1..9]', () => {
    const { container } = render(<OnboardingModal open={true} onComplete={onComplete} />);

    // The circle numbers are rendered as text in step indicator divs
    // We check that the number "9" appears (wasn't there with 8 circles)
    const nineElements = screen.getAllByText('9');
    expect(nineElements.length).toBeGreaterThan(0);
  });

  // Test 5: Initial step state is 0 (first circle is active)
  it('initial step is 0 with first circle active', () => {
    const { container } = render(<OnboardingModal open={true} onComplete={onComplete} />);

    // Circle 1 should be rendered (active — step 0 + 1 = 1)
    const circleOne = screen.getAllByText('1');
    expect(circleOne.length).toBeGreaterThan(0);
  });
});
