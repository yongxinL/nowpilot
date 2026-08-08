// tests/components/OnboardingModal.test.tsx — Flow 9 step 1 (D-06/D-07):
// welcome + persona card + provider-choice UI skeleton with the four canonical
// provider ids disabled, and the 'Configure later' escape that marks onboarding
// done in AddonSettingsStore (np_addon_settings 'onboarding'.done) so the
// SidePanelRouter exits to the disabled surface (asserted in the router test).
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingModal } from '@/components/OnboardingModal';
import { STR } from '@/core/i18n/strings';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';

beforeEach(() => {
  useAddonSettingsStore.setState({ settings: {} });
});

describe('OnboardingModal (Flow 9 step 1)', () => {
  it('renders the welcome heading, body, and persona card (E7)', () => {
    render(<OnboardingModal />);
    expect(screen.getByText(STR.onboarding.heading)).toBeTruthy();
    expect(screen.getByText(STR.onboarding.body)).toBeTruthy();
    expect(screen.getByRole('button', { name: STR.onboarding.configureProvider })).toBeTruthy();
  });

  it('renders the provider-choice UI skeleton with the four canonical provider ids disabled', () => {
    render(<OnboardingModal />);
    for (const id of ['openai', 'anthropic', 'gemini', 'ollama']) {
      const button = screen.getByRole('button', { name: id });
      expect(button).toBeDisabled();
    }
  });

  it("'Configure later' marks onboarding done in the addon settings store (D-06 escape)", () => {
    render(<OnboardingModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure later' }));
    expect(useAddonSettingsStore.getState().getSetting('onboarding', 'done')).toBe(true);
  });
});
