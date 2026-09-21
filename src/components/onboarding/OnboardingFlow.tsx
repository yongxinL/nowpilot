import React from 'react';
import type { ProviderId } from '../../types';
import type { ProviderValidationPort } from '../../services/ports/providerValidationPort';

/**
 * RED-half skeleton for the shared onboarding flow (D-05 / D-06 / D-08).
 *
 * The four-step presentation, the one state machine and the key-hygiene
 * lifecycle land in this task's GREEN half; the module exists here so the
 * suite collects and each case fails on its own assertion.
 */

export type OnboardingSurface = 'sidepanel' | 'standalone';

export type OnboardingStateRead =
  | { status: 'ok'; state: { uiComplete: boolean; providerId: ProviderId | null } }
  | { status: 'unknown'; reason: string };

export interface OnboardingCompletionSelection {
  persona: string | null;
  providerId: ProviderId;
}

export interface OnboardingFlowProps {
  open: boolean;
  surface: OnboardingSurface;
  validationPort: ProviderValidationPort;
  onComplete: (selection: OnboardingCompletionSelection) => void;
  onSkip: () => void;
  readOnboardingState?: () => Promise<OnboardingStateRead>;
  onSwitchToFullSetup?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = () => null;
