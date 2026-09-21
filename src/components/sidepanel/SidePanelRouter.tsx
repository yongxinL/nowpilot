import React from 'react';
import { SidePanelShell, type SidePanelShellProps } from './SidePanelShell';

/**
 * The Side Panel's single surface-routing decision point (D-06): onboarding
 * versus the Chat shell, with no navigation rail.
 *
 * Phase 1 lands the shell branch. Plan `01-09` adds the onboarding branch
 * here — and only here — once `src/components/onboarding/OnboardingFlow.tsx`
 * exists; the flow controller is surface-independent and must not be reached
 * from a surface root directly.
 */
export type SidePanelRouterProps = SidePanelShellProps;

export const SidePanelRouter: React.FC<SidePanelRouterProps> = (props) => (
  <SidePanelShell {...props} />
);
