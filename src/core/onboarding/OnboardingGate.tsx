import React, { useState } from 'react';
import { OnboardingModal, useProviderExists } from './OnboardingModal';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const hasProvider = useProviderExists();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const showModal = !hasProvider && !onboardingDone;

  return (
    <>
      {children}
      <OnboardingModal open={showModal} onComplete={() => setOnboardingDone(true)} />
    </>
  );
}
